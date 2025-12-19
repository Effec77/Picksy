class BankingStrategyAgent:
    # Strategy Constants
    DEFAULT_MONTHLY_DISCRETIONARY_BUDGET = 20000 # Example default in currency
    
    def __init__(self):
        self.name = "Banking Agent (Universal)"
        # Universal Wallet applied to all users (No login required)
        self.user_wallet = {
            "cards": [
                {"name": "Universal Travel Card", "category": "travel", "points_multiplier": 3.0, "insurance": "High", "type": "credit"},
                {"name": "Standard Cashback Card", "category": "shopping", "cashback": 0.05, "insurance": "Medium", "type": "credit"},
                {"name": "Premium Reserve", "category": "luxury", "points_multiplier": 1.0, "insurance": "Max", "type": "credit"},
                {"name": "Bank Debit", "category": "check", "cashback": 0.0, "insurance": "None", "type": "debit"}
            ]
        }

    def evaluate_transaction_impact(self, product_name, price, user_budget=None):
        """
        Calculates impact on budget and recommends best card.
        Non-blocking, purely informational.
        """
        budget = user_budget or self.DEFAULT_MONTHLY_DISCRETIONARY_BUDGET
        impact_percentage = (price / budget) * 100
        
        # 1. Budget Impact Analysis
        impact_level = "Low"
        impact_color = "green"
        if impact_percentage > 50:
            impact_level = "High"
            impact_color = "red"
        elif impact_percentage > 20: 
            impact_level = "Medium"
            impact_color = "orange"
            
        impact_msg = f"This is {impact_percentage:.1f}% of your estimated monthly discretionary budget (₹{budget})."

        # 2. Reward Optimization
        best_card, details = self._optimize_rewards(product_name, price)
        
        return {
            "impact_level": impact_level,
            "impact_color": impact_color,
            "impact_message": impact_msg,
            "best_payment_method": {
                "name": best_card['name'],
                "rationale": details['msg'],
                "estimated_value": f"₹{int(details['val'])}"
            }
        }

    def _optimize_rewards(self, product_name, price):
        best_card = None
        best_value = -1.0
        details = {}

        for card in self.user_wallet['cards']:
            value = 0
            message = ""
            
            # Simple matching logic
            name_lower = product_name.lower()
            card_name_lower = card['name'].lower()
            
            if "amazon" in name_lower and "amazon" in card_name_lower:
                value = price * card.get('cashback', 0.05)
                message = "5% Cashback applied"
            elif price > 5000 and card['category'] == "travel": 
                value = (price / 100) * card.get('points_multiplier', 1) * 1.5 
                message = "Best for high value items"
            elif card['type'] == 'debit':
                value = 0 
                message = "Avoid Debt"
            else:
                value = price * 0.01 # Base 1%
                message = "Standard 1% Reward"
            
            if value > best_value:
                best_value = value
                best_card = card
                details = {"msg": message, "val": value}
        
        # Fallback
        if not best_card:
            best_card = self.user_wallet['cards'][0]
            details = {"msg": "Default Card", "val": 0}
            
        return best_card, details
