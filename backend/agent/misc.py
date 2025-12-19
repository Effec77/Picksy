import random
from datetime import datetime, timedelta

class MiscAgent:
    def __init__(self):
        self.alerts = []

    def get_price_history(self, current_price, product_title=""):
        """
        Generates a realistic mock price history graph data.
        Returns: labels (dates), data (prices), highest, lowest
        """
        try:
            price = float(str(current_price).replace(',', '').replace('₹', '').replace('$', ''))
        except:
            price = 1000.0 # fallback

        # Generate 6 months of data
        dates = []
        prices = []
        base_price = price
        
        # Trend logic: slight volatility + major dips (sales)
        current_date = datetime.now()
        for i in range(180, 0, -5): # every 5 days for last 6 months
            d = current_date - timedelta(days=i)
            dates.append(d.strftime("%b %d"))
            
            # Random fluctuation +/- 5%
            fluctuation = random.uniform(0.95, 1.05)
            hist_price = base_price * fluctuation
            
            # Simulated Drops (Big Billion Days / Sales)
            if i in range(40, 50) or i in range(120, 130):
                hist_price *= 0.80 # 20% drop
                
            prices.append(int(hist_price))
            
        # Ensure the last point matches current price approx
        prices[-1] = int(price)
        
        return {
            "labels": dates,
            "data": prices,
            "highest": max(prices),
            "lowest": min(prices),
            "current": int(price)
        }

    def set_price_alert(self, product_url, target_price, email):
        """
        Simulates setting a price drop alert.
        """
        alert = {
            "url": product_url,
            "target": target_price,
            "email": email,
            "created_at": datetime.now().isoformat()
        }
        self.alerts.append(alert)
        return {"status": "success", "message": f"Alert set for {target_price}!"}

    def get_coupons(self, domain):
        """
        Returns mock coupons based on domain.
        """
        common_coupons = [
            {"code": "WELCOME10", "desc": "10% off your first order", "success_rate": "98%"},
            {"code": "PICKSY20", "desc": "Flat 20% off via Picksy", "success_rate": "45%"},
            {"code": "FREESHIP", "desc": "Free Shipping on orders > $50", "success_rate": "80%"}
        ]
        
        if "amazon" in domain:
            return common_coupons + [{"code": "AMZ5", "desc": "5% Cashback on Amazon Pay", "success_rate": "90%"}]
        if "myntra" in domain:
            return common_coupons + [{"code": "MYNTRA300", "desc": "Flat 300 off on 1999", "success_rate": "70%"}]
            
        return common_coupons
