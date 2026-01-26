import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Apple, Beef, Carrot, Milk, Wheat, Droplets, Candy, Clock } from "lucide-react";

interface ExchangeItem {
    name: string;
    portion: string;
}

interface ExchangeCategory {
    title: string;
    icon: React.ReactNode;
    color: string;
    items: ExchangeItem[];
}

const exchangeData: ExchangeCategory[] = [
    {
        title: "Leche y derivados",
        icon: <Milk className="h-5 w-5" />,
        color: "text-blue-600 bg-blue-50 border-blue-200",
        items: [
            { name: "Leche entera", portion: "1 vaso pequeño (200ml)" },
            { name: "Kumis y yogur", portion: "1 vaso pequeño (200ml)" },
            { name: "Polvo", portion: "4 cucharadas soperas (26g)" },
            { name: "Yogur griego", portion: "1 vaso pequeño (200ml)" },
            { name: "Avena líquida", portion: "1 vaso pequeño (200ml)" },
        ]
    },
    {
        title: "Quesos y sustitutos",
        icon: <Milk className="h-5 w-5" />,
        color: "text-cyan-600 bg-cyan-50 border-cyan-200",
        items: [
            { name: "Quesito, queso", portion: "1 tajada delgada (30g)" },
            { name: "Cuajada", portion: "1 tajada delgada (30g)" },
            { name: "Huevo", portion: "1 unidad (50g)" },
            { name: "Queso mozzarella", portion: "2 lonchitas (34g)" },
            { name: "Jamón", portion: "2 tajadas (42g)" },
            { name: "Mortadela", portion: "2 tajadas (42g)" },
            { name: "Salchicha", portion: "1 unidad (25g)" },
            { name: "Salchichón", portion: "1 tajada gruesa (34g)" },
            { name: "Chorizo", portion: "1 unidad" },
        ]
    },
    {
        title: "Carnes",
        icon: <Beef className="h-5 w-5" />,
        color: "text-rose-600 bg-rose-50 border-rose-200",
        items: [
            { name: "Atún en agua", portion: "1 lata (120g)" },
            { name: "Cerdo (lomo-cañón)", portion: "100g" },
            { name: "Res", portion: "100g" },
            { name: "Contramuslo", portion: "86g" },
            { name: "Muslo", portion: "75g" },
            { name: "Pechuga", portion: "80g" },
            { name: "Alas de pollo", portion: "84g" },
            { name: "Salmón", portion: "73g" },
            { name: "Trucha", portion: "81g" },
            { name: "Pargo", portion: "100g" },
        ]
    },
    {
        title: "Cereales",
        icon: <Wheat className="h-5 w-5" />,
        color: "text-amber-600 bg-amber-50 border-amber-200",
        items: [
            { name: "Arepa de maíz", portion: "1 unidad" },
            { name: "Arroz blanco", portion: "6 cuch (80g)" },
            { name: "Avena en hojuelas", portion: "4 cuch (24g)" },
            { name: "Espaguetis", portion: "65g" },
            { name: "Pasta corta", portion: "65g" },
            { name: "Tortilla de maíz", portion: "1 unidad" },
        ]
    },
    {
        title: "Frutos secos",
        icon: <Droplets className="h-5 w-5" />,
        color: "text-orange-600 bg-orange-50 border-orange-200",
        items: [
            { name: "Maní sin sal", portion: "10g" },
            { name: "Almendras sin sal", portion: "9g" },
            { name: "Pistachos", portion: "9g" },
        ]
    },
    {
        title: "Raíces, tubérculos y plátanos",
        icon: <Wheat className="h-5 w-5" />,
        color: "text-yellow-600 bg-yellow-50 border-yellow-200",
        items: [
            { name: "Papa común", portion: "83g" },
            { name: "Papa criolla", portion: "108g" },
            { name: "Plátano verde", portion: "66g" },
            { name: "Plátano maduro", portion: "78g" },
            { name: "Yuca", portion: "62g" },
        ]
    },
    {
        title: "Frutas",
        icon: <Apple className="h-5 w-5" />,
        color: "text-red-600 bg-red-50 border-red-200",
        items: [
            { name: "Manzana", portion: "1 unidad" },
            { name: "Pera", portion: "1 unidad" },
            { name: "Fresa", portion: "9 unidades" },
            { name: "Mango", portion: "112g" },
            { name: "Banano", portion: "1 unidad" },
            { name: "Piña", portion: "110g" },
            { name: "Sandía", portion: "156g" },
            { name: "Kiwi", portion: "1 unidad" },
        ]
    },
    {
        title: "Verduras",
        icon: <Carrot className="h-5 w-5" />,
        color: "text-emerald-600 bg-emerald-50 border-emerald-200",
        items: [
            { name: "Brócoli", portion: "89g" },
            { name: "Cebolla blanca", portion: "74g" },
            { name: "Cebolla roja", portion: "66g" },
            { name: "Champiñón", portion: "100g" },
            { name: "Coliflor", portion: "86g" },
            { name: "Habichuela", portion: "81g" },
            { name: "Remolacha cocida", portion: "57g" },
            { name: "Tomate", portion: "118g" },
            { name: "Zanahoria", portion: "58g" },
        ]
    },
    {
        title: "Grasas",
        icon: <Droplets className="h-5 w-5" />,
        color: "text-lime-600 bg-lime-50 border-lime-200",
        items: [
            { name: "Aguacate común", portion: "30g" },
            { name: "Aguacate hass", portion: "30g" },
            { name: "Aceite de oliva", portion: "1 cucharada" },
        ]
    },
    {
        title: "Leguminosas",
        icon: <Wheat className="h-5 w-5" />,
        color: "text-brown-600 bg-brown-50 border-brown-200",
        items: [
            { name: "Lenteja con guiso", portion: "130g" },
            { name: "Garbanzo con guiso", portion: "100g" },
            { name: "Frijol cargamanto", portion: "110g" },
            { name: "Frijol blanquillo con guiso", portion: "110g" },
        ]
    }
];

export const ExchangeList: React.FC = () => {
    return (
        <div className="space-y-6">
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-6">
                <p className="text-sm text-primary font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Nota: Un intercambio equivale a una porción. Consulta tu plan para saber cuántos intercambios te corresponden por cada grupo de alimentos.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {exchangeData.map((category, index) => (
                    <Card key={index} className="border-border shadow-md hover:shadow-lg transition-all duration-300 overflow-hidden group">
                        <CardHeader className={`p-4 flex flex-row items-center gap-3 border-b ${category.color}`}>
                            <div className="p-2 rounded-lg bg-white shadow-sm shrink-0">
                                {category.icon}
                            </div>
                            <CardTitle className="text-sm lg:text-base font-bold truncate">
                                {category.title}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-border">
                                {category.items.map((item, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors">
                                        <span className="text-xs lg:text-sm text-foreground font-medium truncate pr-2">
                                            {item.name}
                                        </span>
                                        <Badge variant="outline" className="text-[10px] lg:text-xs font-normal border-primary/20 text-primary bg-primary/5 shrink-0">
                                            {item.portion}
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
};
