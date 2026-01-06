import { useState } from "react";
import { ChevronUp, Building, Bed } from "lucide-react";
import { cn } from "@/lib/utils";

export function DormitoryDropdown({ stats }) {
    const [isOpen, setIsOpen] = useState(false);

    // Calculate total params for summary
    const totalInscrits = stats.reduce((acc, curr) => acc + curr.nombre_inscrits, 0);
    const totalCapacite = stats.reduce((acc, curr) => acc + curr.capacite, 0);

    return (
        <div
            className={cn(
                "w-full rounded-2xl shadow-sm overflow-hidden cursor-pointer select-none border border-border-light dark:border-border-dark mb-4",
                "bg-white dark:bg-gray-800",
                "transition-all duration-300 ease-in-out",
                isOpen ? "rounded-3xl shadow-md ring-2 ring-primary/5" : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
            )}
            onClick={() => setIsOpen(!isOpen)}
        >
            {/* Header */}
            <div className="flex items-center gap-4 p-4">
                <div className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-xl transition-all duration-300",
                    isOpen ? "bg-primary text-white shadow-lg shadow-primary/30 scale-110" : "bg-primary/10 text-primary"
                )}>
                    <Building className="h-6 w-6" />
                </div>
                <div className="flex-1 overflow-hidden">
                    <h3 className="text-base font-bold text-text-main dark:text-white">
                        Occupation des dortoirs
                    </h3>
                    <p
                        className={cn(
                            "text-sm text-text-secondary dark:text-gray-400",
                            "transition-all duration-300 ease-in-out",
                            isOpen ? "opacity-0 max-h-0 mt-0" : "opacity-100 max-h-6 mt-0.5"
                        )}
                    >
                        {totalInscrits} / {totalCapacite} places occupées
                    </p>
                </div>
                <div className="flex h-8 w-8 items-center justify-center">
                    <ChevronUp
                        className={cn(
                            "h-5 w-5 text-text-secondary transition-transform duration-500",
                            isOpen ? "rotate-0" : "rotate-180"
                        )}
                    />
                </div>
            </div>

            {/* Stats Grid */}
            <div
                className={cn(
                    "grid",
                    "transition-all duration-500 ease-in-out",
                    isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                )}
            >
                <div className="overflow-hidden">
                    <div className="px-4 pb-4">
                        <div className="grid grid-cols-2 gap-3">
                            {stats.map((stat, index) => {
                                const tauxNum = parseFloat(stat.taux_remplissage);
                                let colorClass = 'bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30';

                                if (tauxNum >= 90) {
                                    colorClass = 'bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 border-red-100 dark:border-red-900/30';
                                } else if (tauxNum >= 70) {
                                    colorClass = 'bg-orange-50 dark:bg-orange-900/10 text-orange-600 dark:text-orange-400 border-orange-100 dark:border-orange-900/30';
                                }

                                return (
                                    <div
                                        key={stat.id}
                                        className={cn(
                                            "flex flex-col p-3 rounded-xl border transition-all duration-500",
                                            colorClass,
                                            isOpen ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
                                        )}
                                        style={{ transitionDelay: isOpen ? `${index * 50}ms` : "0ms" }}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-sm font-bold truncate pr-2">{stat.nom}</span>
                                            <Bed className="h-4 w-4 opacity-70 flex-shrink-0" />
                                        </div>

                                        <div className="space-y-2 mt-auto">
                                            <div className="text-xl font-bold tracking-tight leading-none">
                                                {stat.nombre_inscrits}
                                                <span className="text-xs opacity-70 font-normal ml-1">
                                                    /{stat.capacite}
                                                </span>
                                            </div>
                                            <div className="w-full bg-black/5 dark:bg-white/10 rounded-full h-1.5">
                                                <div
                                                    className="h-full rounded-full bg-current transition-all duration-1000"
                                                    style={{ width: `${Math.min(tauxNum, 100)}%` }}
                                                />
                                            </div>
                                            <div className="text-[10px] opacity-80 font-medium">
                                                {stat.places_disponibles} libres
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
