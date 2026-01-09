import { Card } from "@/components/ui/card";
import { Clock, CheckCheck, DollarSign, Users } from "lucide-react";

export function PaymentStats({ stats, activeFilter, onFilterChange }) {
    const formatMontant = (montant) => {
        return new Intl.NumberFormat("fr-FR").format(montant || 0) + " FCFA";
    };

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card
                className={`p-5 cursor-pointer transition-all ${
                    activeFilter === "en_attente" ? "ring-2 ring-amber-500" : "hover:shadow-md"
                }`}
                onClick={() => onFilterChange?.("en_attente")}
            >
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20">
                        <Clock className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                        <p className="text-sm text-text-secondary">En attente</p>
                        <p className="text-xl font-bold text-amber-600">{stats.enAttente}</p>
                    </div>
                </div>
            </Card>
            <Card
                className={`p-5 cursor-pointer transition-all ${
                    activeFilter === "valides" ? "ring-2 ring-emerald-500" : "hover:shadow-md"
                }`}
                onClick={() => onFilterChange?.("valides")}
            >
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
                        <CheckCheck className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                        <p className="text-sm text-text-secondary">Validés / Soldés</p>
                        <p className="text-xl font-bold text-emerald-600">{stats.valides}</p>
                    </div>
                </div>
            </Card>
            <Card className="p-5">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                        <DollarSign className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                        <p className="text-sm text-text-secondary">Total collecté</p>
                        <p className="text-xl font-bold text-blue-600">{formatMontant(stats.totalCollecte)}</p>
                    </div>
                </div>
            </Card>
            <Card
                className={`p-5 cursor-pointer transition-all ${
                    activeFilter === "tous" ? "ring-2 ring-primary" : "hover:shadow-md"
                }`}
                onClick={() => onFilterChange?.("tous")}
            >
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                        <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <p className="text-sm text-text-secondary">Total inscriptions</p>
                        <p className="text-xl font-bold text-primary">{stats.total}</p>
                    </div>
                </div>
            </Card>
        </div>
    );
}
