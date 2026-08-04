"""
WHO Growth Charts Generator
Creates growth charts with z-score curves and individual measurements
"""

import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import Rectangle
import numpy as np
from datetime import date, datetime, timedelta
from typing import List, Dict, Tuple, Optional
from who_lms_calculator import WHOLMSCalculator
import io
import base64

class WHOGrowthChartsGenerator:
    """Generate WHO growth charts with measurements plotted"""
    
    def __init__(self, dpi: int = 100, style: str = 'seaborn-v0_8-darkgrid'):
        self.dpi = dpi
        self.calculator = WHOLMSCalculator()
        try:
            plt.style.use(style)
        except:
            pass  # Use default if style not available
    
    @staticmethod
    def generate_age_range(start_months: float, end_months: float, step: float = 0.5) -> np.ndarray:
        """Generate age range in months"""
        return np.arange(start_months, end_months + step, step)
    
    def generate_percentile_curves(
        self,
        lms_table: Dict,
        percentiles: List[float] = [3, 10, 25, 50, 75, 90, 97],
        age_range: Optional[np.ndarray] = None
    ) -> Dict[float, np.ndarray]:
        """
        Generate percentile curves from LMS data
        percentiles: list of percentiles to calculate (e.g., [3, 10, 25, 50, 75, 90, 97])
        """
        if age_range is None:
            age_range = self.generate_age_range(0, 60, 0.5)
        
        from scipy.stats import norm
        
        percentile_curves = {}
        
        for percentile in percentiles:
            z_score = norm.ppf(percentile / 100)
            values = []
            
            for age_months in age_range:
                L, M, S = self.calculator.interpolate_lms(age_months, lms_table)
                
                # Inverse LMS formula to get measurement from z-score
                if L == 0:
                    measurement = M * np.exp(z_score * S)
                else:
                    measurement = M * np.power(1 + L * S * z_score, 1 / L)
                
                values.append(measurement)
            
            percentile_curves[percentile] = np.array(values)
        
        return percentile_curves, age_range
    
    def plot_weight_for_age(
        self,
        sex: str = 'M',
        measurements: Optional[List[Dict]] = None,
        title: str = "Peso para la edad (WHO)"
    ) -> Tuple[plt.Figure, str]:
        """
        Plot weight-for-age chart
        measurements: list of dicts with keys: age_months, weight_kg, date (optional)
        """
        fig, ax = plt.subplots(figsize=(12, 8), dpi=self.dpi)
        
        # Select appropriate LMS table
        lms_table = (self.calculator.WEIGHT_FOR_AGE_BOYS 
                     if sex.upper() == 'M' 
                     else self.calculator.WEIGHT_FOR_AGE_GIRLS)
        
        # Generate percentile curves
        percentile_curves, age_range = self.generate_percentile_curves(
            lms_table,
            percentiles=[3, 10, 25, 50, 75, 90, 97],
            age_range=self.generate_age_range(0, 60, 0.5)
        )
        
        # Plot percentile curves
        colors = {
            3: '#d62728', 10: '#ff7f0e', 25: '#ffbb78',
            50: '#2ca02c', 75: '#98df8a', 90: '#1f77b4', 97: '#aec7e8'
        }
        
        for percentile, values in percentile_curves.items():
            if percentile == 50:
                ax.plot(age_range, values, color=colors[percentile], linewidth=2.5, 
                       label=f'P{percentile} (mediana)', zorder=3)
            else:
                ax.plot(age_range, values, color=colors[percentile], linewidth=1, 
                       alpha=0.7, linestyle='--', label=f'P{percentile}', zorder=2)
        
        # Plot individual measurements if provided
        if measurements:
            ages = []
            weights = []
            for m in measurements:
                ages.append(m.get('age_months', 0))
                weights.append(m.get('weight_kg', 0))
            
            ax.scatter(ages, weights, color='red', s=100, marker='o', 
                      zorder=4, label='Mediciones', edgecolors='darkred', linewidth=2)
            
            # Connect measurements with a line
            if len(ages) > 1:
                sorted_indices = np.argsort(ages)
                sorted_ages = np.array(ages)[sorted_indices]
                sorted_weights = np.array(weights)[sorted_indices]
                ax.plot(sorted_ages, sorted_weights, color='red', linewidth=1.5, 
                       alpha=0.5, zorder=3)
        
        # Formatting
        ax.set_xlabel('Edad (meses)', fontsize=12, fontweight='bold')
        ax.set_ylabel('Peso (kg)', fontsize=12, fontweight='bold')
        ax.set_title(title, fontsize=14, fontweight='bold', pad=20)
        ax.set_xlim(0, 60)
        ax.grid(True, alpha=0.3, zorder=1)
        ax.legend(loc='upper left', fontsize=9, framealpha=0.9)
        
        # Add sex indicator
        sex_label = 'Niño' if sex.upper() == 'M' else 'Niña'
        ax.text(0.98, 0.02, f'Estándar WHO - {sex_label}', 
               transform=ax.transAxes, fontsize=9, 
               verticalalignment='bottom', horizontalalignment='right',
               bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.5))
        
        plt.tight_layout()
        
        # Convert to base64 for embedding
        buffer = io.BytesIO()
        fig.savefig(buffer, format='png', dpi=self.dpi)
        buffer.seek(0)
        image_base64 = base64.b64encode(buffer.read()).decode()
        
        return fig, image_base64
    
    def plot_length_for_age(
        self,
        sex: str = 'M',
        measurements: Optional[List[Dict]] = None,
        title: str = "Talla para la edad (WHO)"
    ) -> Tuple[plt.Figure, str]:
        """Plot length-for-age chart"""
        fig, ax = plt.subplots(figsize=(12, 8), dpi=self.dpi)
        
        lms_table = (self.calculator.LENGTH_FOR_AGE_BOYS 
                     if sex.upper() == 'M' 
                     else self.calculator.LENGTH_FOR_AGE_GIRLS)
        
        percentile_curves, age_range = self.generate_percentile_curves(
            lms_table,
            percentiles=[3, 10, 25, 50, 75, 90, 97],
            age_range=self.generate_age_range(0, 60, 0.5)
        )
        
        colors = {
            3: '#d62728', 10: '#ff7f0e', 25: '#ffbb78',
            50: '#2ca02c', 75: '#98df8a', 90: '#1f77b4', 97: '#aec7e8'
        }
        
        for percentile, values in percentile_curves.items():
            if percentile == 50:
                ax.plot(age_range, values, color=colors[percentile], linewidth=2.5, 
                       label=f'P{percentile} (mediana)', zorder=3)
            else:
                ax.plot(age_range, values, color=colors[percentile], linewidth=1, 
                       alpha=0.7, linestyle='--', label=f'P{percentile}', zorder=2)
        
        if measurements:
            ages = []
            lengths = []
            for m in measurements:
                ages.append(m.get('age_months', 0))
                lengths.append(m.get('length_cm', 0))
            
            ax.scatter(ages, lengths, color='red', s=100, marker='o', 
                      zorder=4, label='Mediciones', edgecolors='darkred', linewidth=2)
            
            if len(ages) > 1:
                sorted_indices = np.argsort(ages)
                sorted_ages = np.array(ages)[sorted_indices]
                sorted_lengths = np.array(lengths)[sorted_indices]
                ax.plot(sorted_ages, sorted_lengths, color='red', linewidth=1.5, 
                       alpha=0.5, zorder=3)
        
        ax.set_xlabel('Edad (meses)', fontsize=12, fontweight='bold')
        ax.set_ylabel('Talla (cm)', fontsize=12, fontweight='bold')
        ax.set_title(title, fontsize=14, fontweight='bold', pad=20)
        ax.set_xlim(0, 60)
        ax.grid(True, alpha=0.3, zorder=1)
        ax.legend(loc='upper left', fontsize=9, framealpha=0.9)
        
        sex_label = 'Niño' if sex.upper() == 'M' else 'Niña'
        ax.text(0.98, 0.02, f'Estándar WHO - {sex_label}', 
               transform=ax.transAxes, fontsize=9, 
               verticalalignment='bottom', horizontalalignment='right',
               bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.5))
        
        plt.tight_layout()
        
        buffer = io.BytesIO()
        fig.savefig(buffer, format='png', dpi=self.dpi)
        buffer.seek(0)
        image_base64 = base64.b64encode(buffer.read()).decode()
        
        return fig, image_base64
    
    def plot_head_circumference_for_age(
        self,
        sex: str = 'M',
        measurements: Optional[List[Dict]] = None,
        title: str = "Perímetro cefálico para la edad (WHO)"
    ) -> Tuple[plt.Figure, str]:
        """Plot head circumference-for-age chart"""
        fig, ax = plt.subplots(figsize=(12, 8), dpi=self.dpi)
        
        lms_table = (self.calculator.HEAD_CIRCUMFERENCE_BOYS 
                     if sex.upper() == 'M' 
                     else self.calculator.HEAD_CIRCUMFERENCE_GIRLS)
        
        percentile_curves, age_range = self.generate_percentile_curves(
            lms_table,
            percentiles=[3, 10, 25, 50, 75, 90, 97],
            age_range=self.generate_age_range(0, 60, 0.5)
        )
        
        colors = {
            3: '#d62728', 10: '#ff7f0e', 25: '#ffbb78',
            50: '#2ca02c', 75: '#98df8a', 90: '#1f77b4', 97: '#aec7e8'
        }
        
        for percentile, values in percentile_curves.items():
            if percentile == 50:
                ax.plot(age_range, values, color=colors[percentile], linewidth=2.5, 
                       label=f'P{percentile} (mediana)', zorder=3)
            else:
                ax.plot(age_range, values, color=colors[percentile], linewidth=1, 
                       alpha=0.7, linestyle='--', label=f'P{percentile}', zorder=2)
        
        if measurements:
            ages = []
            hcs = []
            for m in measurements:
                ages.append(m.get('age_months', 0))
                hcs.append(m.get('head_circumference_cm', 0))
            
            ax.scatter(ages, hcs, color='red', s=100, marker='o', 
                      zorder=4, label='Mediciones', edgecolors='darkred', linewidth=2)
            
            if len(ages) > 1:
                sorted_indices = np.argsort(ages)
                sorted_ages = np.array(ages)[sorted_indices]
                sorted_hcs = np.array(hcs)[sorted_indices]
                ax.plot(sorted_ages, sorted_hcs, color='red', linewidth=1.5, 
                       alpha=0.5, zorder=3)
        
        ax.set_xlabel('Edad (meses)', fontsize=12, fontweight='bold')
        ax.set_ylabel('Perímetro cefálico (cm)', fontsize=12, fontweight='bold')
        ax.set_title(title, fontsize=14, fontweight='bold', pad=20)
        ax.set_xlim(0, 60)
        ax.grid(True, alpha=0.3, zorder=1)
        ax.legend(loc='upper left', fontsize=9, framealpha=0.9)
        
        sex_label = 'Niño' if sex.upper() == 'M' else 'Niña'
        ax.text(0.98, 0.02, f'Estándar WHO - {sex_label}', 
               transform=ax.transAxes, fontsize=9, 
               verticalalignment='bottom', horizontalalignment='right',
               bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.5))
        
        plt.tight_layout()
        
        buffer = io.BytesIO()
        fig.savefig(buffer, format='png', dpi=self.dpi)
        buffer.seek(0)
        image_base64 = base64.b64encode(buffer.read()).decode()
        
        return fig, image_base64
    
    def save_chart_to_file(self, fig: plt.Figure, filename: str) -> str:
        """Save chart to file and return path"""
        fig.savefig(filename, dpi=self.dpi, bbox_inches='tight')
        return filename


if __name__ == "__main__":
    import os
    
    generator = WHOGrowthChartsGenerator(dpi=150)
    
    # Example measurements
    measurements_weight = [
        {'age_months': 0, 'weight_kg': 3.5},
        {'age_months': 3, 'weight_kg': 5.8},
        {'age_months': 6, 'weight_kg': 7.3},
        {'age_months': 12, 'weight_kg': 9.5},
        {'age_months': 24, 'weight_kg': 12.8},
    ]
    
    measurements_length = [
        {'age_months': 0, 'length_cm': 50.0},
        {'age_months': 3, 'length_cm': 61.0},
        {'age_months': 6, 'length_cm': 67.0},
        {'age_months': 12, 'length_cm': 75.0},
        {'age_months': 24, 'length_cm': 87.0},
    ]
    
    measurements_hc = [
        {'age_months': 0, 'head_circumference_cm': 34.5},
        {'age_months': 3, 'head_circumference_cm': 40.5},
        {'age_months': 6, 'length_cm': 43.5},
        {'age_months': 12, 'head_circumference_cm': 46.5},
        {'age_months': 24, 'head_circumference_cm': 48.5},
    ]
    
    # Generate charts
    print("Generating WHO Growth Charts...")
    
    fig1, _ = generator.plot_weight_for_age(sex='M', measurements=measurements_weight)
    generator.save_chart_to_file(fig1, 'weight_for_age_chart.png')
    print("✓ Saved: weight_for_age_chart.png")
    
    fig2, _ = generator.plot_length_for_age(sex='M', measurements=measurements_length)
    generator.save_chart_to_file(fig2, 'length_for_age_chart.png')
    print("✓ Saved: length_for_age_chart.png")
    
    fig3, _ = generator.plot_head_circumference_for_age(sex='M', measurements=measurements_hc)
    generator.save_chart_to_file(fig3, 'head_circumference_chart.png')
    print("✓ Saved: head_circumference_chart.png")
    
    plt.close('all')
    print("\nAll charts generated successfully!")
