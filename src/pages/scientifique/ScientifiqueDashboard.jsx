import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
    Users,
    ClipboardCheck,
    BookOpen,
    GraduationCap,
    RefreshCw,
    ArrowRight,
    TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useData } from "@/contexts";

export function ScientifiqueDashboard() {
    const {
        inscriptions,
        notesExamens,
        classes,
        statsScientifique,
        loading,
        refresh,
        lastUpdate,
    } = useData();

    // Participants validés sans note d'entrée
    const participantsSansNote = useMemo(() => {
        const inscriptionIdsAvecNote = new Set(notesExamens.map(n => n.inscription_id));
        return inscriptions.filter(
            i => i.statut === 'valide' && !inscriptionIdsAvecNote.has(i.id)
        );
    }, [inscriptions, notesExamens]);

    // Calcul du taux de remplissage des classes
    const tauxRemplissageClasses = useMemo(() => {
        return classes.map(classe => {
            const effectif = notesExamens.filter(n => n.classe_id === classe.id).length;
            const taux = classe.capacite > 0 ? (effectif / classe.capacite) * 100 : 0;
            return { ...classe, effectif, taux };
        });
    }, [classes, notesExamens]);

    const formatDate = (date) => {
        if (!date) return "Jamais";
        return new Date(date).toLocaleString("fr-FR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    return (
        <div className="p-4 lg:p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-text-main dark:text-white">
                        Tableau de bord
                    </h1>
                    <p className="text-text-secondary mt-1">
                        Cellule Scientifique - Gestion des examens
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-xs text-text-secondary">
                        Mise à jour: {formatDate(lastUpdate)}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={refresh}
                        disabled={loading}
                    >
                        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                        Actualiser
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-text-secondary">Participants validés</p>
                                <p className="text-3xl font-bold text-text-main dark:text-white mt-1">
                                    {statsScientifique.totalParticipantsValides}
                                </p>
                            </div>
                            <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                                <Users className="h-6 w-6 text-blue-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-text-secondary">Avec note d'entrée</p>
                                <p className="text-3xl font-bold text-text-main dark:text-white mt-1">
                                    {statsScientifique.participantsAvecNoteEntree}
                                </p>
                            </div>
                            <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
                                <ClipboardCheck className="h-6 w-6 text-green-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-text-secondary">Sans note d'entrée</p>
                                <p className="text-3xl font-bold text-orange-600 mt-1">
                                    {participantsSansNote.length}
                                </p>
                            </div>
                            <div className="h-12 w-12 rounded-full bg-orange-500/10 flex items-center justify-center">
                                <ClipboardCheck className="h-6 w-6 text-orange-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-text-secondary">Classes créées</p>
                                <p className="text-3xl font-bold text-text-main dark:text-white mt-1">
                                    {statsScientifique.totalClasses}
                                </p>
                            </div>
                            <div className="h-12 w-12 rounded-full bg-purple-500/10 flex items-center justify-center">
                                <GraduationCap className="h-6 w-6 text-purple-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Répartition par niveau */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-blue-600" />
                            Répartition par niveau
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-3 rounded-lg bg-red-50 dark:bg-red-900/20">
                                <div className="flex items-center gap-3">
                                    <div className="h-3 w-3 rounded-full bg-red-500" />
                                    <span className="font-medium text-text-main dark:text-white">Débutant</span>
                                </div>
                                <Badge variant="destructive">
                                    {statsScientifique.parNiveau.debutant} participants
                                </Badge>
                            </div>
                            <div className="flex items-center justify-between p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20">
                                <div className="flex items-center gap-3">
                                    <div className="h-3 w-3 rounded-full bg-orange-500" />
                                    <span className="font-medium text-text-main dark:text-white">Moyen</span>
                                </div>
                                <Badge variant="warning">
                                    {statsScientifique.parNiveau.moyen} participants
                                </Badge>
                            </div>
                            <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
                                <div className="flex items-center gap-3">
                                    <div className="h-3 w-3 rounded-full bg-green-500" />
                                    <span className="font-medium text-text-main dark:text-white">Supérieur</span>
                                </div>
                                <Badge variant="success">
                                    {statsScientifique.parNiveau.superieur} participants
                                </Badge>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Classes et taux de remplissage */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <GraduationCap className="h-5 w-5 text-purple-600" />
                            Remplissage des classes
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3 max-h-64 overflow-y-auto">
                            {tauxRemplissageClasses.length === 0 ? (
                                <p className="text-text-secondary text-center py-4">
                                    Aucune classe créée
                                </p>
                            ) : (
                                tauxRemplissageClasses.map(classe => (
                                    <div key={classe.id} className="space-y-1">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="font-medium text-text-main dark:text-white">
                                                {classe.nom}
                                            </span>
                                            <span className="text-text-secondary">
                                                {classe.effectif}/{classe.capacite}
                                            </span>
                                        </div>
                                        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full transition-all ${
                                                    classe.taux >= 100
                                                        ? "bg-red-500"
                                                        : classe.taux >= 70
                                                        ? "bg-orange-500"
                                                        : "bg-green-500"
                                                }`}
                                                style={{ width: `${Math.min(classe.taux, 100)}%` }}
                                            />
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Actions rapides */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Link to="/scientifique/test-entree">
                    <Card className="hover:border-blue-500 transition-colors cursor-pointer h-full">
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="h-12 w-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                        <ClipboardCheck className="h-6 w-6 text-blue-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-text-main dark:text-white">
                                            Saisir les tests d'entrée
                                        </h3>
                                        <p className="text-sm text-text-secondary">
                                            {participantsSansNote.length} participant(s) en attente
                                        </p>
                                    </div>
                                </div>
                                <ArrowRight className="h-5 w-5 text-text-secondary" />
                            </div>
                        </CardContent>
                    </Card>
                </Link>

                <Link to="/scientifique/notes">
                    <Card className="hover:border-blue-500 transition-colors cursor-pointer h-full">
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="h-12 w-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                                        <BookOpen className="h-6 w-6 text-green-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-text-main dark:text-white">
                                            Gérer les notes
                                        </h3>
                                        <p className="text-sm text-text-secondary">
                                            {statsScientifique.participantsAvecNoteEntree - statsScientifique.participantsAvecMoyenne} en attente de notes
                                        </p>
                                    </div>
                                </div>
                                <ArrowRight className="h-5 w-5 text-text-secondary" />
                            </div>
                        </CardContent>
                    </Card>
                </Link>
            </div>
        </div>
    );
}
