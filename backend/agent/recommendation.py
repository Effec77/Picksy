class RecommendationAgent:
    def __init__(self):
        self.name = "Recommendation Agent (Live Logic)"

    def get_recommendations(self, history):
        """
        Generates logic-based recommendations from user history.
        Does NOT use a hardcoded product catalog.
        """
        if not history:
            return [
                {"title": "Start Browsing", "reason": "We need history to make suggestions!"},
                {"title": "Visit Amazon/Flipkart", "reason": "Scan products to populate this list."}
            ]

        recommendations = []
        
        # Analyze last viewed item
        last_item = history[-1] if history else ""
        
        # Dynamic Generative Logic based on keywords
        # This replaces the hardcoded "Sony -> Bose" dictionary with a rule-based generator
        
        if "phone" in last_item.lower() or "iphone" in last_item.lower() or "android" in last_item.lower():
            recommendations.append({"title": "Screen Protectors", "reason": f"Essential accessory for your new {last_item}"})
            recommendations.append({"title": "Fast Chargers (20W+)", "reason": "For faster charging"})
            
        elif "laptop" in last_item.lower() or "macbook" in last_item.lower():
            recommendations.append({"title": "Laptop Sleeves", "reason": "Protect your device"})
            recommendations.append({"title": "Wireless Mouse", "reason": "Better productivity"})
            
        elif "shoe" in last_item.lower() or "sneaker" in last_item.lower():
            recommendations.append({"title": "Shoe Cleaning Kit", "reason": "Keep them fresh"})
            recommendations.append({"title": "Matching Socks", "reason": "Complete the look"})
            
        elif "watch" in last_item.lower():
            recommendations.append({"title": "Extra Watch Straps", "reason": "Style customization"})
            
        else:
            # Fallback for unknown categories
            recommendations.append({"title": "Similar Items on Amazon", "reason": f"Search for more '{last_item}'"})
            recommendations.append({"title": "Compare Prices", "reason": "Find the best deal"})

        # Always add a 'Deep Search' option
        recommendations.append({
            "title": f"Review Analysis for {last_item[:15]}...",
            "reason": "Check what others say"
        })

        return recommendations
