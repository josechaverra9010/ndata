"""
WHO LMS Calculator for Pediatric Growth Standards
Implements the LMS method for calculating z-scores according to WHO standards
Based on: WHO Child Growth Standards 0-5 years
"""

from dataclasses import dataclass
from typing import Dict, Tuple, Optional
from datetime import datetime, date
import math

@dataclass
class LMSParameters:
    """LMS parameters for a specific age and measurement"""
    L: float  # Box-Cox power
    M: float  # Median
    S: float  # Coefficient of variation
    age_days: float
    measurement_type: str  # 'weight', 'length', 'head_circumference', 'weight_for_length'

class WHOLMSCalculator:
    """
    Calculates z-scores using WHO LMS method for children 0-5 years
    Reference: WHO Child Growth Standards
    """
    
    # WHO LMS data for weight-for-age (0-60 months) - SIMPLIFIED SAMPLE
    # In production, this should be loaded from WHO official LMS tables
    WEIGHT_FOR_AGE_BOYS = {
        # age_months: (L, M, S)
        0: (-1.3361, 3.3464, 0.14171),
        1: (-1.2653, 4.3013, 0.12595),
        2: (-1.1849, 5.1075, 0.11454),
        3: (-1.0961, 5.8081, 0.10641),
        6: (-0.7853, 7.3365, 0.09220),
        12: (-0.3522, 9.3075, 0.08366),
        24: (0.2581, 12.8320, 0.08234),
        36: (0.6017, 15.7730, 0.08578),
        48: (0.8623, 18.4220, 0.08883),
        60: (1.0788, 20.6280, 0.09053),
    }
    
    WEIGHT_FOR_AGE_GIRLS = {
        0: (-1.3225, 3.2315, 0.14657),
        1: (-1.2529, 4.1850, 0.13049),
        2: (-1.1757, 4.9735, 0.11883),
        3: (-1.0917, 5.6448, 0.11050),
        6: (-0.7849, 7.0997, 0.09620),
        12: (-0.3697, 8.8871, 0.08810),
        24: (0.2366, 12.0005, 0.08656),
        36: (0.5889, 14.6450, 0.08923),
        48: (0.8506, 17.0050, 0.09195),
        60: (1.0705, 19.0280, 0.09358),
    }
    
    # WHO LMS data for length-for-age (0-60 months) - SIMPLIFIED SAMPLE
    LENGTH_FOR_AGE_BOYS = {
        0: (0.3183, 49.9, 0.03594),
        1: (0.3092, 54.7, 0.03346),
        2: (0.3006, 58.4, 0.03154),
        3: (0.2924, 61.4, 0.03027),
        6: (0.2710, 67.6, 0.02804),
        12: (0.2463, 75.7, 0.02657),
        24: (0.2058, 87.0, 0.02569),
        36: (0.1765, 95.3, 0.02541),
        48: (0.1523, 102.3, 0.02529),
        60: (0.1330, 108.2, 0.02516),
    }
    
    LENGTH_FOR_AGE_GIRLS = {
        0: (0.3181, 49.2, 0.03765),
        1: (0.3090, 54.0, 0.03489),
        2: (0.3004, 57.7, 0.03272),
        3: (0.2923, 60.6, 0.03118),
        6: (0.2711, 66.7, 0.02872),
        12: (0.2463, 74.3, 0.02704),
        24: (0.2060, 85.3, 0.02605),
        36: (0.1768, 93.3, 0.02570),
        48: (0.1526, 100.0, 0.02556),
        60: (0.1333, 105.6, 0.02541),
    }
    
    # WHO LMS data for head circumference-for-age (0-60 months)
    HEAD_CIRCUMFERENCE_BOYS = {
        0: (1.0961, 34.3, 0.03730),
        1: (1.0788, 37.3, 0.03480),
        2: (1.0627, 39.4, 0.03290),
        3: (1.0477, 41.0, 0.03155),
        6: (1.0101, 43.8, 0.02887),
        12: (0.9544, 46.4, 0.02655),
        24: (0.8881, 48.8, 0.02535),
        36: (0.8330, 50.3, 0.02483),
        48: (0.7886, 51.5, 0.02454),
        60: (0.7533, 52.4, 0.02433),
    }
    
    HEAD_CIRCUMFERENCE_GIRLS = {
        0: (1.0815, 33.7, 0.03910),
        1: (1.0642, 36.7, 0.03643),
        2: (1.0481, 38.8, 0.03433),
        3: (1.0331, 40.3, 0.03280),
        6: (0.9954, 42.9, 0.02994),
        12: (0.9397, 45.2, 0.02749),
        24: (0.8733, 47.4, 0.02619),
        36: (0.8181, 48.8, 0.02562),
        48: (0.7737, 49.9, 0.02531),
        60: (0.7384, 50.7, 0.02510),
    }
    
    @staticmethod
    def calculate_age_days(birth_date: date, measurement_date: date) -> float:
        """Calculate age in days"""
        delta = measurement_date - birth_date
        return delta.days
    
    @staticmethod
    def calculate_age_months(age_days: float) -> float:
        """Convert days to months (30.4375 days per month average)"""
        return age_days / 30.4375
    
    @staticmethod
    def interpolate_lms(age_months: float, lms_table: Dict) -> Tuple[float, float, float]:
        """
        Interpolate LMS values for a given age using linear interpolation
        """
        ages = sorted(lms_table.keys())
        
        # Find surrounding ages
        if age_months <= ages[0]:
            return lms_table[ages[0]]
        if age_months >= ages[-1]:
            return lms_table[ages[-1]]
        
        # Find the two ages that bracket the target age
        for i in range(len(ages) - 1):
            if ages[i] <= age_months <= ages[i + 1]:
                age1, age2 = ages[i], ages[i + 1]
                L1, M1, S1 = lms_table[age1]
                L2, M2, S2 = lms_table[age2]
                
                # Linear interpolation
                t = (age_months - age1) / (age2 - age1)
                L = L1 + t * (L2 - L1)
                M = M1 + t * (M2 - M1)
                S = S1 + t * (S2 - S1)
                
                return L, M, S
        
        return lms_table[ages[-1]]
    
    @staticmethod
    def calculate_z_score(measurement: float, L: float, M: float, S: float) -> float:
        """
        Calculate z-score using LMS method
        Formula: z = [((measurement/M)^L - 1) / (L * S)]
        """
        if M <= 0 or S <= 0:
            return 0.0
        
        if L == 0:
            # When L=0, use logarithmic transformation
            z = (math.log(measurement / M)) / S
        else:
            # Box-Cox transformation
            z = ((math.pow(measurement / M, L) - 1) / (L * S))
        
        # Clamp z-score between -3 and 3 for practical purposes
        return max(-3.0, min(3.0, z))
    
    @staticmethod
    def z_score_to_percentile(z_score: float) -> float:
        """Convert z-score to percentile using normal distribution"""
        # Approximation using error function
        from math import erf
        percentile = 50 * (1 + erf(z_score / math.sqrt(2)))
        return max(0.1, min(99.9, percentile))
    
    @staticmethod
    def classify_nutritional_status(z_score: float, indicator: str = "weight_for_age") -> str:
        """
        Classify nutritional status based on z-score
        WHO Classification for children 0-5 years
        """
        if indicator == "weight_for_age":
            if z_score < -2:
                return "Desnutrición severa"
            elif z_score < -1:
                return "Desnutrición moderada"
            elif z_score < 1:
                return "Normal"
            elif z_score < 2:
                return "Riesgo de sobrepeso"
            else:
                return "Sobrepeso/Obesidad"
        
        elif indicator == "length_for_age":
            if z_score < -2:
                return "Retraso severo del crecimiento"
            elif z_score < -1:
                return "Retraso del crecimiento"
            elif z_score < 1:
                return "Normal"
            else:
                return "Crecimiento acelerado"
        
        elif indicator == "head_circumference":
            if z_score < -2:
                return "Microcefalia"
            elif z_score < -1:
                return "Perímetro cefálico bajo"
            elif z_score < 1:
                return "Normal"
            else:
                return "Macrocefalia"
        
        return "Normal"
    
    def calculate_growth_indicators(
        self,
        birth_date: date,
        measurement_date: date,
        sex: str,  # 'M' or 'F'
        weight_kg: Optional[float] = None,
        length_cm: Optional[float] = None,
        head_circumference_cm: Optional[float] = None,
    ) -> Dict:
        """
        Calculate all growth indicators and z-scores for a child
        """
        age_days = self.calculate_age_days(birth_date, measurement_date)
        age_months = self.calculate_age_months(age_days)
        
        results = {
            "age_days": age_days,
            "age_months": age_months,
            "sex": sex,
            "indicators": {}
        }
        
        # Select appropriate LMS tables based on sex
        weight_table = self.WEIGHT_FOR_AGE_BOYS if sex.upper() == 'M' else self.WEIGHT_FOR_AGE_GIRLS
        length_table = self.LENGTH_FOR_AGE_BOYS if sex.upper() == 'M' else self.LENGTH_FOR_AGE_GIRLS
        hc_table = self.HEAD_CIRCUMFERENCE_BOYS if sex.upper() == 'M' else self.HEAD_CIRCUMFERENCE_GIRLS
        
        # Weight-for-age
        if weight_kg is not None and age_months <= 60:
            L, M, S = self.interpolate_lms(age_months, weight_table)
            z_score = self.calculate_z_score(weight_kg, L, M, S)
            percentile = self.z_score_to_percentile(z_score)
            classification = self.classify_nutritional_status(z_score, "weight_for_age")
            
            results["indicators"]["weight_for_age"] = {
                "measurement": weight_kg,
                "unit": "kg",
                "L": L,
                "M": M,
                "S": S,
                "z_score": round(z_score, 2),
                "percentile": round(percentile, 1),
                "classification": classification
            }
        
        # Length-for-age
        if length_cm is not None and age_months <= 60:
            L, M, S = self.interpolate_lms(age_months, length_table)
            z_score = self.calculate_z_score(length_cm, L, M, S)
            percentile = self.z_score_to_percentile(z_score)
            classification = self.classify_nutritional_status(z_score, "length_for_age")
            
            results["indicators"]["length_for_age"] = {
                "measurement": length_cm,
                "unit": "cm",
                "L": L,
                "M": M,
                "S": S,
                "z_score": round(z_score, 2),
                "percentile": round(percentile, 1),
                "classification": classification
            }
        
        # Head circumference-for-age
        if head_circumference_cm is not None and age_months <= 60:
            L, M, S = self.interpolate_lms(age_months, hc_table)
            z_score = self.calculate_z_score(head_circumference_cm, L, M, S)
            percentile = self.z_score_to_percentile(z_score)
            classification = self.classify_nutritional_status(z_score, "head_circumference")
            
            results["indicators"]["head_circumference"] = {
                "measurement": head_circumference_cm,
                "unit": "cm",
                "L": L,
                "M": M,
                "S": S,
                "z_score": round(z_score, 2),
                "percentile": round(percentile, 1),
                "classification": classification
            }
        
        return results


if __name__ == "__main__":
    # Test example
    calculator = WHOLMSCalculator()
    
    birth_date = date(2023, 1, 15)
    measurement_date = date(2024, 1, 15)
    
    results = calculator.calculate_growth_indicators(
        birth_date=birth_date,
        measurement_date=measurement_date,
        sex='M',
        weight_kg=9.5,
        length_cm=75.0,
        head_circumference_cm=46.5
    )
    
    print("=== WHO Growth Standards Calculation ===")
    print(f"Age: {results['age_months']:.1f} months ({results['age_days']} days)")
    print(f"Sex: {'Male' if results['sex'] == 'M' else 'Female'}")
    print()
    
    for indicator, data in results["indicators"].items():
        print(f"{indicator.replace('_', ' ').title()}:")
        print(f"  Measurement: {data['measurement']} {data['unit']}")
        print(f"  Z-score: {data['z_score']}")
        print(f"  Percentile: {data['percentile']}th")
        print(f"  Classification: {data['classification']}")
        print()
