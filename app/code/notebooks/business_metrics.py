# business_metrics.py
# Ce fichier charge les prédictions/validation et calcule les 4 métriques clés

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn
from fastapi.middleware.cors import CORSMiddleware 
import lightgbm as lgb
import pickle


print("=== BUSINESS METRICS – Chargement des prédictions/validation ===")

# -----------------------------------------------------------------------------
# Chargement des éléments sauvegardés par model_training.py
# -----------------------------------------------------------------------------
try:
    val_proba = np.load('val_proba.npy')
    y_val = np.load('y_val.npy')
    X_val = pd.read_pickle('X_val.pkl')
    best_threshold = np.load('best_threshold.npy').item()  # c'est un float
    print("Chargement réussi !")
except FileNotFoundError as e:
    print("ERREUR : Fichiers de validation non trouvés.")
    print("Exécute d'abord model_training.py pour générer val_proba.npy, etc.")
    print(e)
    exit(1)

# -----------------------------------------------------------------------------
# Calcul des 4 métriques clés
# -----------------------------------------------------------------------------

MARGE_MOYENNE = 0.30
COUT_PROMO_CIBLEE = 2.0
COUT_PROMO_NON_CIBLEE = 16.0  # ex. 8× plus cher car non ciblé

# 1. Avg Gain / Customer
prix_moyen = X_val['price'].mean() if 'price' in X_val.columns else 4.5
nb_reco_moyen = (val_proba > best_threshold).mean() * 4  # ×4 = estimation réaliste
avg_gain_per_customer = nb_reco_moyen * prix_moyen * MARGE_MOYENNE

# 2. Basket Increase (%)
panier_moyen_actuel = X_val['price'].mean() * 10  # approx. 10 produits
nouveau_panier = panier_moyen_actuel + avg_gain_per_customer
basket_increase_pct = (avg_gain_per_customer / panier_moyen_actuel) * 100 if panier_moyen_actuel > 0 else 0

# 3. Promotion ROI (ciblé vs non ciblé)
revenu_cible = avg_gain_per_customer * 1000
revenu_non_cible = revenu_cible * 0.35  # efficacité supposée 35 %

roi_cible = (revenu_cible - COUT_PROMO_CIBLEE * 1000) / (COUT_PROMO_CIBLEE * 1000)
roi_non_cible = (revenu_non_cible - COUT_PROMO_NON_CIBLEE * 1000) / (COUT_PROMO_NON_CIBLEE * 1000)

# 4. Gain on 1,000 Customers
gain_1000_customers = avg_gain_per_customer * 1000

# -----------------------------------------------------------------------------
# API pour envoyer au frontend Node.js
# -----------------------------------------------------------------------------
app = FastAPI(title="DSTI Retail Metrics API")

# Autorise ton frontend React (localhost ou domaine déployé)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class MetricsResponse(BaseModel):
    avg_gain_per_customer: float
    basket_increase_percent: float
    promotion_roi_targeted: float
    promotion_roi_untargeted: float
    gain_on_1000_customers: float

@app.get("/api/key-metrics", response_model=MetricsResponse)
async def get_key_metrics():
    return {
        "avg_gain_per_customer": round(avg_gain_per_customer, 2),
        "basket_increase_percent": round(basket_increase_pct, 1),
        "promotion_roi_targeted": round(roi_cible, 1),
        "promotion_roi_untargeted": round(roi_non_cible, 1),
        "gain_on_1000_customers": round(gain_1000_customers)
    }



# Charge ton modèle une seule fois (au démarrage)
model = lgb.Booster(model_file='model_reorder.txt')

# Charge les produits pour avoir les noms
products = pd.read_csv('../Data/products.csv')

# Charge ton df complet ou les features nécessaires
# (si tu as tout en mémoire, super ; sinon recharge depuis pickle)
try:
    df_full = pd.read_pickle('df_full.pkl')  # si tu as sauvegardé tout df
except:
    df_full = None  # fallback : tu recomputes ou charges à la demande

class UserRequest(BaseModel):
    user_id: int

@app.post("/api/predict")
async def predict_for_user(request: UserRequest):
    user_id = request.user_id
    
    # Vérifie si l'utilisateur existe dans ton dataset
    if df_full is not None and user_id not in df_full['user_id'].values:
        raise HTTPException(status_code=404, detail=f"User ID {user_id} not found in training data")
    
    # Récupère les données de cet utilisateur (produits déjà achetés + features)
    # Si df_full existe → filtre
    if df_full is not None:
        user_data = df_full[df_full['user_id'] == user_id].copy()
    else:
        # Sinon : fallback minimal (à adapter selon ton code)
        raise HTTPException(status_code=500, detail="df_full not loaded - cannot predict")
    
    # Prédiction des probabilités
    # Charge la liste features (exactement la même que dans le notebook)
    with open('features_list.pkl', 'rb') as f:
        features = pickle.load(f)

    print(f"features chargées depuis pickle : {len(features)} colonnes")
    print(features)  # pour vérifier
    try:
        user_data['proba'] = model.predict(user_data[features])  # 'features' doit être défini
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")
    
    # Ajoute le nom du produit
    user_data = user_data.merge(
        products[['product_id', 'product_name']],
        on='product_id',
        how='left'
    )
    
    # Trie par probabilité descendante et prend top 10
    top_10 = user_data.sort_values('proba', ascending=False).head(10)
    
    # Formatte pour le frontend (colonnes demandées)
    result = []
    for _, row in top_10.iterrows():
        result.append({
            "Product": row['product_name'] or f"Product {row['product_id']}",
            "PROB": round(row['proba'], 4),
            "Price": round(row['price'], 2) if 'price' in row else None,
            "bought": int(row['user_product_orders']) if 'user_product_orders' in row else 0,
            "re-purchased": "Yes" if row['label'] == 1 else "No"
        })
    
    return {
        "user_id": user_id,
        "top_10_recommended": result,
        "message": f"Top 10 products with highest repurchase probability for user {user_id}"
    }



# -------------------------------------------------------------------------
# ROUTE POUR LES RÈGLES FP-GROWTH
# -------------------------------------------------------------------------


@app.get("/api/fp-growth-rules")
async def get_fp_growth_rules():
    try:
        # Charge le fichier pickle contenant top_rules
        with open('top_rules.pkl', 'rb') as f:
            top_rules = pickle.load(f)
        
        # Vérifie que c'est bien un DataFrame
        if not isinstance(top_rules, pd.DataFrame):
            return {"error": "top_rules n'est pas un DataFrame valide"}
        
        # Formate les colonnes 'antecedents' et 'consequents' (souvent des frozensets)
        # en une chaîne lisible pour le frontend
        top_rules['Bundle'] = top_rules.apply(
            lambda row: ', '.join(
                list(row['antecedents']) + list(row['consequents'])
            ) if isinstance(row['antecedents'], (frozenset, set, list)) and isinstance(row['consequents'], (frozenset, set, list)) else "N/A",
            axis=1
        )

        # Sélectionne et renomme les colonnes pour le frontend
        result_df = top_rules[['Bundle', 'estimated_revenue_per_100k_orders', 'support']].copy()
        result_df = result_df.rename(columns={
            'estimated_revenue_per_100k_orders': 'Est. Utility/Profit (€)',
            'support': 'Support'
        })
        
        # Formate Support en pourcentage (ex. 4.5% au lieu de 0.045)
        result_df['Support'] = (result_df['Support'] * 100).round(2).astype(str) + '%'
        
        # Formate le profit avec 2 décimales
        result_df['Est. Utility/Profit (€)'] = result_df['Est. Utility/Profit (€)'].round(2)
        
        # Trie par profit descendant et prend les top 10
        result_df = result_df.sort_values('Est. Utility/Profit (€)', ascending=False).head(10)
        
        # Convertit en liste de dictionnaires (format JSON parfait pour React)
        result = result_df.to_dict(orient='records')

        return {
            "top_rules": result,
            "total_rules_found": len(top_rules),
            "message": "Top 10 frequent and/or profitable bundles from FP-Growth"
        }
    
    except FileNotFoundError:
        return {"error": "Fichier top_rules.pkl non trouvé. Exécute d'abord le notebook FP-Growth."}
    except Exception as e:
        return {"error": f"Erreur lors du chargement/formatage : {str(e)}"}






if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)