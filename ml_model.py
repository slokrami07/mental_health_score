import os
import gc
import numpy as np 
import pandas as pd 
import seaborn as sns 
import matplotlib.pyplot as plt
from sklearn.model_selection import train_test_split, RandomizedSearchCV
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import FunctionTransformer, StandardScaler, OrdinalEncoder, OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import r2_score, mean_absolute_error, mean_squared_error
import joblib 

# Set to True if you want interactive GUI popup windows for plots
SHOW_PLOTS = False
SAVE_PLOTS = True
PLOTS_DIR = "eda_plots"

def handle_plot(fig_name):
    """Save or display plot cleanly to prevent Tkinter / multiprocessing deadlocks."""
    if SAVE_PLOTS:
        os.makedirs(PLOTS_DIR, exist_ok=True)
        plt.savefig(os.path.join(PLOTS_DIR, fig_name), bbox_inches='tight', dpi=150)
    if SHOW_PLOTS:
        plt.show()
    plt.close('all')

def main():
    df = pd.read_csv("Student Social Media And Mental Health Impact.csv")
    print("Dataset Shape:", df.shape)
    print("\nDataset Head:")
    print(df.head())
    print("\nMissing Values:")
    print(df.isnull().sum())
    print("\nDuplicate Rows:", df.duplicated().sum())
    print("\nDataset Info:")
    df.info()
    print("\nDataset Summary Statistics:")
    print(df.describe())

    # --- EDA ---
    print("\n--- Generating EDA Plots ---")
    # 1. Distribution of target variable
    plt.figure(figsize=(8, 5))
    sns.histplot(df['Mental_Health_Score'], kde=True)
    plt.title("Distribution of Mental Health Score")
    handle_plot("target_distribution.png")

    # 2. Correlation Heatmap
    plt.figure(figsize=(10, 8))
    sns.heatmap(df.corr(numeric_only=True), annot=True, cmap='coolwarm', fmt=".2f")
    plt.title("Correlation Heatmap")
    handle_plot("correlation_heatmap.png")

    # 3. Boxplot: Stress Level vs Mental Health Score
    order = ['Low', 'Medium', 'High', 'Very High']
    plt.figure(figsize=(8, 5))
    sns.boxplot(y="Mental_Health_Score", x="Stress_Level", data=df, order=order, hue="Stress_Level", palette="viridis", legend=False)
    plt.title("Mental Health Score by Stress Level")
    handle_plot("stress_vs_mental_health.png")

    # 4. Scatterplots
    plt.figure(figsize=(8, 5))
    sns.scatterplot(x="Avg_Daily_Usage_Hours", y="Mental_Health_Score", data=df, hue="Stress_Level")
    plt.title("Daily Usage vs Mental Health Score")
    handle_plot("usage_vs_mental_health.png")

    plt.figure(figsize=(8, 5))
    sns.scatterplot(x="Sleep_Hours_Per_Night", y="Mental_Health_Score", data=df, hue="Stress_Level")
    plt.title("Sleep Hours vs Mental Health Score")
    handle_plot("sleep_vs_mental_health.png")

    # 5. Platform count
    plt.figure(figsize=(10, 5))
    sns.countplot(x=df["Most_Used_Platform"], order=df["Most_Used_Platform"].value_counts().index)
    plt.title("Most Used Platforms")
    plt.xticks(rotation=45)
    handle_plot("platform_counts.png")

    if SAVE_PLOTS:
        print(f"EDA plots saved to ./{PLOTS_DIR}/")

    # Clean up any leftover GUI memory before multiprocessing
    gc.collect()

    # --- Outlier Detection ---
    num_features = df.select_dtypes(include="number")
    Q1 = num_features.quantile(0.25)
    Q3 = num_features.quantile(0.75)
    IQR = Q3 - Q1
    lower_bound = Q1 - 1.5 * IQR
    upper_bound = Q3 + 1.5 * IQR

    outliers = (num_features < lower_bound) | (num_features > upper_bound)
    print("\nOutliers detected per feature:")
    print(outliers.sum())

    # --- Data Cleaning ---
    # 1. Drop duplicates
    df = df.drop_duplicates()

    # 2. Convert negative values to realistic non-negative values
    df["Physical_Activity_Hours"] = df["Physical_Activity_Hours"].clip(lower=0)

    # 3. Group rare countries
    top_countries = df['Country'].value_counts().index[:10].tolist()
    df['Grouped_country'] = df['Country'].apply(lambda c: c if c in top_countries else 'Other')

    # --- Train-Test Split ---
    skewed_col = ['Study_Hours']
    other_numeric_cols = ["Age", "Avg_Daily_Usage_Hours", "Daily_Unlocks", "Physical_Activity_Hours", "Sleep_Hours_Per_Night"]
    ordinal_col = ['Stress_Level']
    normal_col = ["Gender", "Academic_Level", "Most_Used_Platform", "Purpose_Of_Use", "Grouped_country"]

    feature_col = skewed_col + other_numeric_cols + ordinal_col + normal_col
    X = df[feature_col]
    y = df['Mental_Health_Score']

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.30, random_state=42)

    # --- Preprocessing Pipeline ---
    skew_pipeline = Pipeline(steps=[
        ('log_transform', FunctionTransformer(np.log1p)),
        ('scale', StandardScaler())
    ])

    plain_numeric_pipeline = Pipeline(steps=[
        ('scale', StandardScaler())
    ])

    ordinal_pipeline = Pipeline(steps=[
        ('encode', OrdinalEncoder(categories=[['Low', 'Medium', 'High', 'Very High']]))
    ])

    nominal_pipeline = Pipeline(steps=[
        ('encode', OneHotEncoder(handle_unknown="ignore"))
    ])

    preprocessor = ColumnTransformer(transformers=[
        ("Skewed_Pipeline", skew_pipeline, skewed_col),
        ("Plain_Numeric", plain_numeric_pipeline, other_numeric_cols),
        ('Ordinal', ordinal_pipeline, ordinal_col),
        ('Normal', nominal_pipeline, normal_col)
    ])

    # --- Model 1: Linear Regression ---
    print("\n--- Training Linear Regression ---")
    lr_pipeline = Pipeline(steps=[
        ('preprocessor', preprocessor),
        ('regressor', LinearRegression())
    ])

    lr_pipeline.fit(X_train, y_train)
    lr_preds = lr_pipeline.predict(X_test)
    lr_preds_train = lr_pipeline.predict(X_train)

    lr_r2_testing = r2_score(y_test, lr_preds)
    lr_r2_training = r2_score(y_train, lr_preds_train)
    lr_mae = mean_absolute_error(y_test, lr_preds)
    lr_rmse = np.sqrt(mean_squared_error(y_test, lr_preds))

    print(f"Linear Regression Training R2 : {lr_r2_training:.4f}")
    print(f"Linear Regression Testing R2  : {lr_r2_testing:.4f}")
    print(f"Linear Regression MAE         : {lr_mae:.4f}")
    print(f"Linear Regression RMSE        : {lr_rmse:.4f}")

    # --- Model 2: Default Random Forest ---
    print("\n--- Training Default Random Forest ---")
    rf_pipeline = Pipeline(steps=[
        ('preprocessor', preprocessor),
        ('random forest', RandomForestRegressor(random_state=42))
    ])

    rf_pipeline.fit(X_train, y_train)
    rf_preds = rf_pipeline.predict(X_test)
    rf_preds_training = rf_pipeline.predict(X_train)

    rf_r2_testing = r2_score(y_test, rf_preds)
    rf_r2_training = r2_score(y_train, rf_preds_training)
    rf_mae = mean_absolute_error(y_test, rf_preds)
    rf_rmse = np.sqrt(mean_squared_error(y_test, rf_preds))

    print(f"Random Forest Training R2 : {rf_r2_training:.4f}")
    print(f"Random Forest Testing R2  : {rf_r2_testing:.4f}")
    print(f"Random Forest MAE         : {rf_mae:.4f}")
    print(f"Random Forest RMSE        : {rf_rmse:.4f}")

    # --- Hyperparameter Tuning: RandomizedSearchCV ---
    print("\n--- Hyperparameter Tuning with RandomizedSearchCV ---")
    param_grid = {
        'random forest__n_estimators'       : [100, 200, 300],
        'random forest__max_depth'         : [5, 10, 15],
        'random forest__min_samples_split' : [2, 5, 10],
        'random forest__min_samples_leaf'  : [1, 2, 4]
    }

    random_search = RandomizedSearchCV(
        estimator=rf_pipeline,
        param_distributions=param_grid,
        n_iter=15,
        cv=5,
        scoring='r2',
        random_state=42,
        n_jobs=-1,
        verbose=1
    )

    print("Fitting RandomizedSearchCV (15 iterations x 5 folds = 75 fits)...")
    random_search.fit(X_train, y_train)

    print(f"\nBest Parameters found: {random_search.best_params_}")

    rf_best_pipeline = random_search.best_estimator_
    rf_tuned_preds = rf_best_pipeline.predict(X_test)
    rf_tuned_training_preds = rf_best_pipeline.predict(X_train)

    rf_tuned_r2 = r2_score(y_test, rf_tuned_preds)
    r2_tuned_training = r2_score(y_train, rf_tuned_training_preds)
    rf_tuned_mae = mean_absolute_error(y_test, rf_tuned_preds)
    rf_tuned_rmse = np.sqrt(mean_squared_error(y_test, rf_tuned_preds))

    print(f"Tuned Random Forest Training R2 : {r2_tuned_training:.4f}")
    print(f"Tuned Random Forest Testing R2  : {rf_tuned_r2:.4f}")
    print(f"Tuned Random Forest MAE         : {rf_tuned_mae:.4f}")
    print(f"Tuned Random Forest RMSE        : {rf_tuned_rmse:.4f}")

    # --- Final Results Comparison ---
    results = pd.DataFrame({
        'Model': ['Linear Regression', 'Random Forest (default)', 'Random Forest (tuned)'],
        'Testing R2': [lr_r2_testing, rf_r2_testing, rf_tuned_r2],
        'Training R2': [lr_r2_training, rf_r2_training, r2_tuned_training],
        'MAE': [lr_mae, rf_mae, rf_tuned_mae],
        'RMSE': [lr_rmse, rf_rmse, rf_tuned_rmse]
    })

    print("\n" + "="*70)
    print("FINAL MODEL COMPARISON SUMMARY:")
    print("="*70)
    print(results.to_string(index=False))
    print("="*70)

    # Save the best tuned model
    joblib.dump(rf_best_pipeline, 'Mental_Health_Model.pkl')
    print("\n[SUCCESS] Best tuned model saved to 'Mental_Health_Model.pkl'")

    return results, rf_best_pipeline

if __name__ == '__main__':
    results, model = main()

