import unittest
import sys
import os
import glob

# Add backend to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agent.reporter import BusinessReporter

class TestReporter(unittest.TestCase):
    def test_generate_excel(self):
        print("\nTesting Excel Report Generation...")
        
        # Mock analyzed data
        reviews = [
            {'id': '1', 'content': 'Great battery', 'verdict': 'Authentic', 'sentiment': 0.8, 'rating': 5},
            {'id': '2', 'content': 'Bad hinge', 'verdict': 'Authentic', 'sentiment': -0.9, 'rating': 1},
            {'id': '3', 'content': 'Fake spam', 'verdict': 'Fake', 'sentiment': 0.0, 'rating': 5}
        ]
        
        reporter = BusinessReporter("Sony Test Product")
        file_path = reporter.generate_excel(reviews)
        
        print(f"Report generated at: {file_path}")
        self.assertTrue(os.path.exists(file_path), "Excel file should exist")
        self.assertTrue(file_path.endswith('.xlsx'), "Should be an xlsx file")
        
        # Cleanup
        try:
            os.remove(file_path)
        except:
            pass

if __name__ == '__main__':
    unittest.main()
