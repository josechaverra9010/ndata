
def calculate_imc(peso, altura_cm):
    altura_m = altura_cm / 100
    return peso / (altura_m * altura_m)

def calculate_ps(altura_cm):
    altura_m = altura_cm / 100
    return 25 * (altura_m * altura_m)

def calculate_pa(peso_actual, ps):
    return ((peso_actual - ps) * 0.25) + ps

def calculate_tmr(peso, edad, genero):
    if genero == "masculino":
        if 18 <= edad <= 30: return (15.057 * peso) + 692.2
        if 31 <= edad <= 60: return (11.472 * peso) + 873.1
        if edad > 60: return (11.711 * peso) + 587.7
    else:
        if 18 <= edad <= 30: return (14.818 * peso) + 486.6
        if 31 <= edad <= 60: return (8.126 * peso) + 845.6
        if edad > 60: return (9.082 * peso) + 658.5
    return 0

# Sample data from Excel
peso = 63.0
altura = 173
edad = 25
genero = "masculino"
pal = 1.53 # Sedentario updated value

imc = calculate_imc(peso, altura)
ps = calculate_ps(altura)
pa = calculate_pa(peso, ps)
tmr = calculate_tmr(peso, edad, genero)
req = tmr * pal

print(f"IMC: {imc:.2f} (Excel: 21.05)")
print(f"PS: {ps:.2f} (Excel: 74.82)")
print(f"PA: {pa:.2f} (Excel: 71.87)")
print(f"TMR: {tmr:.2f} (Excel: 1821.5)")
print(f"Requerimiento (PAL 1.53): {req:.0f}")

# Example logic for Reference Weight in implementation:
# If IMC > 30 use PA, else use Actual
ref_weight = pa if imc > 30 else peso
print(f"Peso Ref (IMC {imc:.2f}): {ref_weight:.2f}")

# Obese example
peso_obeso = 100
imc_obeso = calculate_imc(peso_obeso, altura)
ref_weight_obeso = calculate_pa(peso_obeso, ps) if imc_obeso > 30 else peso_obeso
print(f"Obese example (100kg): IMC {imc_obeso:.2f}, Ref Weight {ref_weight_obeso:.2f}")
