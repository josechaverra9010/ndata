"""
WHO Growth Charts Generator - SVG Version
Creates interactive SVG growth charts without external dependencies
"""

from typing import List, Dict, Optional, Tuple
from datetime import date
import math
from who_lms_calculator import WHOLMSCalculator

class WHOGrowthChartsSVG:
    """Generate WHO growth charts as SVG"""
    
    def __init__(self):
        self.calculator = WHOLMSCalculator()
        self.width = 1200
        self.height = 800
        self.margin = {'top': 60, 'right': 40, 'bottom': 80, 'left': 80}
    
    @staticmethod
    def generate_age_range(start_months: float, end_months: float, step: float = 0.5):
        """Generate age range"""
        ages = []
        current = start_months
        while current <= end_months:
            ages.append(current)
            current += step
        return ages
    
    def percentile_to_z_score(self, percentile: float) -> float:
        """Convert percentile to z-score using approximation"""
        # Approximation of inverse normal distribution
        if percentile == 50:
            return 0.0
        
        p = percentile / 100.0
        if p < 0.5:
            t = math.sqrt(math.log(1.0 / (p * p)))
            z = -(t - (2.515517 + 0.802853 * t + 0.010328 * t * t) / 
                  (1.0 + 1.432788 * t + 0.189269 * t * t + 0.001308 * t * t * t))
        else:
            t = math.sqrt(math.log(1.0 / ((1.0 - p) * (1.0 - p))))
            z = (t - (2.515517 + 0.802853 * t + 0.010328 * t * t) / 
                 (1.0 + 1.432788 * t + 0.189269 * t * t + 0.001308 * t * t * t))
        
        return z
    
    def generate_percentile_values(
        self,
        lms_table: Dict,
        percentile: float,
        age_range: List[float]
    ) -> List[Tuple[float, float]]:
        """Generate (age, measurement) points for a percentile curve"""
        z_score = self.percentile_to_z_score(percentile)
        points = []
        
        for age_months in age_range:
            L, M, S = self.calculator.interpolate_lms(age_months, lms_table)
            
            # Inverse LMS formula
            if L == 0:
                measurement = M * math.exp(z_score * S)
            else:
                measurement = M * math.pow(1 + L * S * z_score, 1 / L)
            
            points.append((age_months, measurement))
        
        return points
    
    def scale_x(self, age_months: float, max_age: float = 60) -> float:
        """Scale age to SVG x coordinate"""
        plot_width = self.width - self.margin['left'] - self.margin['right']
        x = self.margin['left'] + (age_months / max_age) * plot_width
        return x
    
    def scale_y(self, measurement: float, min_val: float, max_val: float) -> float:
        """Scale measurement to SVG y coordinate"""
        plot_height = self.height - self.margin['top'] - self.margin['bottom']
        y = self.margin['top'] + plot_height - ((measurement - min_val) / (max_val - min_val)) * plot_height
        return y
    
    def create_svg_header(self, title: str) -> str:
        """Create SVG header"""
        return f'''<?xml version="1.0" encoding="UTF-8"?>
<svg width="{self.width}" height="{self.height}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
    <defs>
        <style>
            .axis {{ stroke: black; stroke-width: 2; }}
            .grid {{ stroke: #e0e0e0; stroke-width: 1; }}
            .percentile-line {{ stroke-width: 2; fill: none; }}
            .percentile-50 {{ stroke: #2ca02c; }}
            .percentile-other {{ stroke-width: 1; stroke-dasharray: 5,5; }}
            .measurement-point {{ fill: red; stroke: darkred; stroke-width: 2; }}
            .measurement-line {{ stroke: red; stroke-width: 1.5; fill: none; opacity: 0.5; }}
            .axis-label {{ font-family: Arial, sans-serif; font-size: 14px; font-weight: bold; }}
            .title {{ font-family: Arial, sans-serif; font-size: 18px; font-weight: bold; }}
            .legend {{ font-family: Arial, sans-serif; font-size: 11px; }}
            .grid-label {{ font-family: Arial, sans-serif; font-size: 11px; fill: #666; }}
        </style>
    </defs>
    
    <!-- Background -->
    <rect width="{self.width}" height="{self.height}" fill="white"/>
    
    <!-- Title -->
    <text x="{self.width/2}" y="35" text-anchor="middle" class="title">{title}</text>
'''
    
    def create_axes(self, x_label: str, y_label: str, x_max: float, y_min: float, y_max: float) -> str:
        """Create axes and grid"""
        svg = ""
        
        # X axis
        x1 = self.scale_x(0)
        x2 = self.scale_x(x_max)
        y_axis = self.margin['top'] + (self.height - self.margin['top'] - self.margin['bottom'])
        
        svg += f'<line x1="{x1}" y1="{y_axis}" x2="{x2}" y2="{y_axis}" class="axis"/>\n'
        
        # Y axis
        y1 = self.margin['top']
        y2 = y_axis
        svg += f'<line x1="{x1}" y1="{y1}" x2="{x1}" y2="{y2}" class="axis"/>\n'
        
        # X axis label
        svg += f'<text x="{self.width/2}" y="{self.height - 20}" text-anchor="middle" class="axis-label">{x_label}</text>\n'
        
        # Y axis label
        svg += f'<text x="20" y="{self.height/2}" text-anchor="middle" class="axis-label" transform="rotate(-90 20 {self.height/2})">{y_label}</text>\n'
        
        # Grid lines and labels (X axis)
        for age in range(0, int(x_max) + 1, 12):
            x = self.scale_x(age, x_max)
            margin_top = self.margin['top']
            svg += f'<line x1="{x}" y1="{margin_top}" x2="{x}" y2="{y_axis}" class="grid"/>\n'
            svg += f'<text x="{x}" y="{y_axis + 25}" text-anchor="middle" class="grid-label">{age}</text>\n'
        
        # Grid lines and labels (Y axis)
        y_range = y_max - y_min
        y_step = max(1, int(y_range / 8))
        for y_val in range(int(y_min), int(y_max) + 1, y_step):
            y = self.scale_y(y_val, y_min, y_max)
            svg += f'<line x1="{x1}" y1="{y}" x2="{x2}" y2="{y}" class="grid"/>\n'
            svg += f'<text x="{x1 - 10}" y="{y + 4}" text-anchor="end" class="grid-label">{y_val}</text>\n'
        
        return svg
    
    def plot_weight_for_age(
        self,
        sex: str = 'M',
        measurements: Optional[List[Dict]] = None
    ) -> str:
        """Generate weight-for-age SVG chart"""
        lms_table = (self.calculator.WEIGHT_FOR_AGE_BOYS 
                     if sex.upper() == 'M' 
                     else self.calculator.WEIGHT_FOR_AGE_GIRLS)
        
        age_range = self.generate_age_range(0, 60, 0.5)
        
        svg = self.create_svg_header("Peso para la edad (Estándares WHO)")
        
        # Determine y-axis range
        y_min, y_max = 2, 22
        
        svg += self.create_axes("Edad (meses)", "Peso (kg)", 60, y_min, y_max)
        
        # Plot percentile curves
        percentiles = [3, 10, 25, 50, 75, 90, 97]
        colors = {
            3: '#d62728', 10: '#ff7f0e', 25: '#ffbb78',
            50: '#2ca02c', 75: '#98df8a', 90: '#1f77b4', 97: '#aec7e8'
        }
        
        for percentile in percentiles:
            points = self.generate_percentile_values(lms_table, percentile, age_range)
            path_data = self._create_path_data(points, y_min, y_max, 60)
            
            css_class = f"percentile-line percentile-{'50' if percentile == 50 else 'other'}"
            svg += f'<path d="{path_data}" class="{css_class}" stroke="{colors[percentile]}"/>\n'
        
        # Plot measurements
        if measurements:
            # Sort by age
            sorted_measurements = sorted(measurements, key=lambda m: m.get('age_months', 0))
            
            # Create measurement line
            if len(sorted_measurements) > 1:
                measurement_path = self._create_measurement_path(
                    sorted_measurements, 'weight_kg', y_min, y_max, 60
                )
                svg += f'<polyline points="{measurement_path}" class="measurement-line"/>\n'
            
            # Plot measurement points
            for m in sorted_measurements:
                age = m.get('age_months', 0)
                weight = m.get('weight_kg', 0)
                x = self.scale_x(age, 60)
                y = self.scale_y(weight, y_min, y_max)
                svg += f'<circle cx="{x}" cy="{y}" r="5" class="measurement-point"/>\n'
        
        # Legend
        svg += self._create_legend(percentiles, colors)
        
        svg += '</svg>'
        return svg
    
    def plot_length_for_age(
        self,
        sex: str = 'M',
        measurements: Optional[List[Dict]] = None
    ) -> str:
        """Generate length-for-age SVG chart"""
        lms_table = (self.calculator.LENGTH_FOR_AGE_BOYS 
                     if sex.upper() == 'M' 
                     else self.calculator.LENGTH_FOR_AGE_GIRLS)
        
        age_range = self.generate_age_range(0, 60, 0.5)
        
        svg = self.create_svg_header("Talla para la edad (Estándares WHO)")
        
        y_min, y_max = 45, 115
        
        svg += self.create_axes("Edad (meses)", "Talla (cm)", 60, y_min, y_max)
        
        percentiles = [3, 10, 25, 50, 75, 90, 97]
        colors = {
            3: '#d62728', 10: '#ff7f0e', 25: '#ffbb78',
            50: '#2ca02c', 75: '#98df8a', 90: '#1f77b4', 97: '#aec7e8'
        }
        
        for percentile in percentiles:
            points = self.generate_percentile_values(lms_table, percentile, age_range)
            path_data = self._create_path_data(points, y_min, y_max, 60)
            
            css_class = f"percentile-line percentile-{'50' if percentile == 50 else 'other'}"
            svg += f'<path d="{path_data}" class="{css_class}" stroke="{colors[percentile]}"/>\n'
        
        if measurements:
            sorted_measurements = sorted(measurements, key=lambda m: m.get('age_months', 0))
            
            if len(sorted_measurements) > 1:
                measurement_path = self._create_measurement_path(
                    sorted_measurements, 'length_cm', y_min, y_max, 60
                )
                svg += f'<polyline points="{measurement_path}" class="measurement-line"/>\n'
            
            for m in sorted_measurements:
                age = m.get('age_months', 0)
                length = m.get('length_cm', 0)
                x = self.scale_x(age, 60)
                y = self.scale_y(length, y_min, y_max)
                svg += f'<circle cx="{x}" cy="{y}" r="5" class="measurement-point"/>\n'
        
        svg += self._create_legend(percentiles, colors)
        
        svg += '</svg>'
        return svg
    
    def _create_path_data(self, points: List[Tuple[float, float]], y_min: float, y_max: float, x_max: float) -> str:
        """Create SVG path data from points"""
        path_data = []
        for i, (age, measurement) in enumerate(points):
            x = self.scale_x(age, x_max)
            y = self.scale_y(measurement, y_min, y_max)
            if i == 0:
                path_data.append(f"M {x} {y}")
            else:
                path_data.append(f"L {x} {y}")
        return " ".join(path_data)
    
    def _create_measurement_path(self, measurements: List[Dict], key: str, y_min: float, y_max: float, x_max: float) -> str:
        """Create polyline points from measurements"""
        points = []
        for m in measurements:
            age = m.get('age_months', 0)
            value = m.get(key, 0)
            x = self.scale_x(age, x_max)
            y = self.scale_y(value, y_min, y_max)
            points.append(f"{x},{y}")
        return " ".join(points)
    
    def _create_legend(self, percentiles: List[int], colors: Dict) -> str:
        """Create legend"""
        legend_x = self.margin['left'] + 20
        legend_y = self.margin['top'] + 20
        
        svg = '<g class="legend">\n'
        for i, p in enumerate(percentiles):
            y = legend_y + (i * 18)
            svg += f'<line x1="{legend_x}" y1="{y}" x2="{legend_x + 20}" y2="{y}" stroke="{colors[p]}" stroke-width="2"/>\n'
            svg += f'<text x="{legend_x + 30}" y="{y + 4}">P{p}</text>\n'
        svg += '</g>\n'
        
        return svg
    
    def save_to_file(self, svg_content: str, filename: str) -> str:
        """Save SVG to file"""
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(svg_content)
        return filename


if __name__ == "__main__":
    generator = WHOGrowthChartsSVG()
    
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
    
    print("Generating WHO Growth Charts (SVG)...")
    
    # Weight chart
    svg_weight = generator.plot_weight_for_age(sex='M', measurements=measurements_weight)
    generator.save_to_file(svg_weight, 'weight_for_age_chart.svg')
    print("✓ Saved: weight_for_age_chart.svg")
    
    # Length chart
    svg_length = generator.plot_length_for_age(sex='M', measurements=measurements_length)
    generator.save_to_file(svg_length, 'length_for_age_chart.svg')
    print("✓ Saved: length_for_age_chart.svg")
    
    print("\nAll charts generated successfully!")
