import pandas as pd
import xlsxwriter
from datetime import datetime
import os
import json
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

class BusinessReporter:
    def __init__(self, product_name):
        self.product_name = product_name
        # Sanitize filename
        safe_name = "".join([c for c in product_name if c.isalnum() or c in (' ', '-', '_')]).strip()
        self.filename = f"Picksy_Business_Audit_{safe_name}_{datetime.now().strftime('%Y%m%d')}.xlsx"
        
        # Configure Groq
        self.api_key = os.environ.get('GROQ_API_KEY')
        if self.api_key:
            self.client = Groq(api_key=self.api_key)
        else:
            print("⚠️ GROQ_API_KEY not found. Static action plans will be used.")
            self.client = None

    def generate_llm_action_plan(self, context_text, sentiment="Negative"):
        """
        Uses LLM to generate specific engineering and marketing actions.
        """
        if not self.client:
            return "Enable Groq API to see AI Action Plan."

        prompt = f"""
        Act as a Senior Product Consultant. 
        Context: Analyzing '{self.product_name}'.
        
        Review Cluster Sample:
        "{context_text[:500]}..."
        
        Task:
        1. Identify the specific **Technical Fault** or **User Pain Point**.
        2. Propose **2 Engineering Fixes** (Material/Firmware/Design).
        3. Propose **1 Marketing Adjustment** to manage expectations.
        
        Output ONLY a JSON object: 
        {{
            "issue": "Brief Name of Issue",
            "engineering": ["Fix 1", "Fix 2"],
            "marketing": ["Adjustment 1"]
        }}
        """
        
        try:
            response = self.client.chat.completions.create(
                model="llama3-70b-8192",
                messages=[
                    {"role": "system", "content": "You are a JSON-speaking Product Consultant."},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"}
            )
            text = response.choices[0].message.content
            data = json.loads(text)
            
            eng = "\n".join([f"🔧 {x}" for x in data.get('engineering', [])])
            mkt = "\n".join([f"📢 {x}" for x in data.get('marketing', [])])
            return f"ISSUE: {data.get('issue')}\n\nENGINEERING:\n{eng}\n\nMARKETING:\n{mkt}"
            
        except Exception as e:
            print(f"LLM Generation Failed: {e}")
            return "AI Analysis Failed. Please review quotes manually."

    def generate_excel(self, analyzed_reviews, aspects=None):
        """
        Takes the list of reviews and optional Aspect Clusters.
        Generates the 3-Tab Business Audit.
        """
        # --- PREPARE DATA ---
        df = pd.DataFrame(analyzed_reviews)
        
        # Calculate KPI Metrics
        total_reviews = len(df)
        authentic_reviews = df[df['verdict'] == 'Authentic'] if 'verdict' in df.columns else df
        authenticity_score = (len(authentic_reviews) / total_reviews) * 100 if total_reviews > 0 else 0
        
        # Calculate Adjusted Rating
        if 'rating' in authentic_reviews.columns:
            authentic_reviews['rating'] = pd.to_numeric(authentic_reviews['rating'], errors='coerce')
            real_rating = authentic_reviews['rating'].mean()
        else:
            real_rating = 0.0
        if pd.isna(real_rating): real_rating = 0.0

        # --- CREATE EXCEL WRITER ---
        writer = pd.ExcelWriter(self.filename, engine='xlsxwriter')
        workbook = writer.book

        # Define Formats
        header_fmt = workbook.add_format({'bold': True, 'bg_color': '#4F46E5', 'font_color': 'white', 'border': 1})
        warn_fmt = workbook.add_format({'bg_color': '#FECACA', 'font_color': '#991B1B'}) 
        wrap_fmt = workbook.add_format({'text_wrap': True, 'valign': 'top'})

        # ==========================================
        # TAB 1: EXECUTIVE OVERVIEW
        # ==========================================
        summary_data = {
            'Metric': ['Real Authenticity Score', 'Adjusted Star Rating', 'Total Reviews Analyzed', 'Flagged Bot/Spam'],
            'Value': [f"{authenticity_score:.1f}%", f"{real_rating:.1f} / 5.0", total_reviews, total_reviews - len(authentic_reviews)],
            'Picksy Insight': [
                "WARNING: High bot activity detected." if authenticity_score < 70 else "Healthy organic traffic.",
                "This is the 'True' rating excluding fake 5-star spam.",
                "-",
                "Reviews removed from analysis due to duplicate text or heuristic failure."
            ]
        }
        df_summary = pd.DataFrame(summary_data)
        df_summary.to_excel(writer, sheet_name='Executive Overview', index=False, startrow=1)
        
        worksheet = writer.sheets['Executive Overview']
        worksheet.set_column('A:C', 30)
        title_format = workbook.add_format({'bold': True, 'font_size': 20, 'align': 'center', 'valign': 'vcenter', 'font_color': '#4A90E2'})
        worksheet.write('A1', f"Picksy Business Audit: {self.product_name}", title_format)

        # ==========================================
        # TAB 2: THEMATIC BREAKDOWN
        # ==========================================
        breakdown_data = []
        
        if aspects:
            # Use sophisticated Aspect Clustering if available
            print(f"📊 Integrating {len(aspects)} clusters into Excel...")
            for aspect in aspects:
                # We interpret the cluster using LLM
                plan = self.generate_llm_action_plan(aspect['sample_text'])
                
                breakdown_data.append({
                    'Cluster ID': aspect['cluster_id'],
                    'Volume': aspect['size'],
                    'Sample Text': aspect['sample_text'],
                    'AI Action Plan': plan
                })
        else:
            # Fallback to simple logic (Legacy)
            if 'sentiment' in authentic_reviews.columns:
                neg_reviews = authentic_reviews[authentic_reviews['sentiment'] < -0.3]
                if not neg_reviews.empty:
                    quotes = neg_reviews['content'].head(3).tolist()
                    plan = self.generate_llm_action_plan("\n".join(quotes))
                    breakdown_data.append({
                        'Cluster ID': 'Negatives',
                        'Volume': len(neg_reviews),
                        'Sample Text': quotes[0] if quotes else "",
                        'AI Action Plan': plan
                    })

        df_breakdown = pd.DataFrame(breakdown_data)
        df_breakdown.to_excel(writer, sheet_name='Thematic Breakdown', index=False)
        worksheet2 = writer.sheets['Thematic Breakdown']
        worksheet2.set_column('C:C', 50, wrap_fmt)
        worksheet2.set_column('D:D', 60, wrap_fmt)

        # ==========================================
        # TAB 3: EVIDENCE LEDGER
        # ==========================================
        # Ensure we export the new 'scores' dict as string if possible, or just the verdict
        export_df = df.copy()
        if 'scores' in export_df.columns:
            export_df['scores'] = export_df['scores'].astype(str)
            
        export_cols = [c for c in ['review_id', 'content', 'verdict', 'scores', 'source_platform'] if c in export_df.columns]
        export_df[export_cols].to_excel(writer, sheet_name='Evidence Ledger', index=False)
        
        worksheet3 = writer.sheets['Evidence Ledger']
        worksheet3.set_column('B:B', 60)
        
        worksheet3.conditional_format(f'C2:C{len(df)+1}', {
            'type': 'text',
            'criteria': 'containing',
            'value': 'Fake',
            'format': warn_fmt
        })

        writer.close()
        return self.filename
