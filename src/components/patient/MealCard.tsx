import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, Loader2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MealCardProps {
    meal: {
        meal_type: string;
        name: string;
        time: string;
        calories: number;
        completed: boolean;
        description: string;
        protein?: number;
        carbs?: number;
        fat?: number;
        ingredients?: string[];
        instructions?: string[];
        image?: string;
    };
    onToggle: () => void;
    onViewDetails: () => void;
    isUpdating: boolean;
}

export function MealCard({ meal, onToggle, onViewDetails, isUpdating }: MealCardProps) {
    return (
        <div
            onClick={() => !isUpdating && onToggle()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    !isUpdating && onToggle();
                }
            }}
            className={`group w-full flex items-start gap-4 p-4 rounded-2xl border-2 transition-all duration-300 ${meal.completed
                ? "bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/30 shadow-sm"
                : "bg-card border-border hover:border-primary/40 hover:shadow-md"
                } ${isUpdating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
            {/* Icon */}
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-all duration-300 ${meal.completed
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                }`}>
                {isUpdating ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                ) : meal.completed ? (
                    <CheckCircle2 className="h-6 w-6" />
                ) : (
                    <Clock className="h-6 w-6" />
                )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 text-left">
                <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0 flex-1">
                        <h4 className="font-semibold text-foreground text-base mb-1 line-clamp-1">
                            {meal.description}
                        </h4>
                        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                            <span className="font-medium">{meal.name}</span>
                            <span className="text-muted-foreground/60">•</span>
                            <span>{meal.time}</span>
                        </p>
                    </div>
                    <Badge
                        variant={meal.completed ? "default" : "secondary"}
                        className="shrink-0 font-semibold"
                    >
                        {meal.calories} kcal
                    </Badge>
                </div>

                {/* Macronutrients */}
                {(meal.protein && meal.protein > 0) || (meal.carbs && meal.carbs > 0) || (meal.fat && meal.fat > 0) ? (
                    <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border/50">
                        {meal.protein && meal.protein > 0 && (
                            <div className="flex items-center gap-1.5">
                                <div className="h-2 w-2 rounded-full bg-blue-500" />
                                <span className="text-xs text-muted-foreground">
                                    <span className="font-medium text-foreground">{meal.protein}g</span> proteína
                                </span>
                            </div>
                        )}
                        {meal.carbs && meal.carbs > 0 && (
                            <div className="flex items-center gap-1.5">
                                <div className="h-2 w-2 rounded-full bg-amber-500" />
                                <span className="text-xs text-muted-foreground">
                                    <span className="font-medium text-foreground">{meal.carbs}g</span> carbos
                                </span>
                            </div>
                        )}
                        {meal.fat && meal.fat > 0 && (
                            <div className="flex items-center gap-1.5">
                                <div className="h-2 w-2 rounded-full bg-rose-500" />
                                <span className="text-xs text-muted-foreground">
                                    <span className="font-medium text-foreground">{meal.fat}g</span> grasas
                                </span>
                            </div>
                        )}
                    </div>
                ) : null}
            </div>

            {/* View Details Button */}
            <div className="flex flex-col items-center justify-center pl-2 border-l border-border/50">
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                    onClick={(e) => {
                        e.stopPropagation();
                        onViewDetails();
                    }}
                >
                    <Eye className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}
