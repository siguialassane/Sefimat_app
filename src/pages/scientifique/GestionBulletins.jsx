import React, { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { LazyImage } from '@/components/ui/lazy-image';
import { notify } from '@/components/ui/toast';
import { useData } from '@/contexts';
import { sansPepiniereNotes } from "@/lib/scientifique";
import {
    Download,
    FileText,
    Search,
    Users,
    Award,
    Filter,
    GraduationCap,
    Loader2,
    AlertCircle,
    CheckCircle,
    User,
    RefreshCw
} from 'lucide-react';

export default function GestionBulletins() {
    // Utiliser le DataContext global au lieu de charger localement
    const { 
        notesExamens, 
        loading: dataLoading,
        lastUpdate,
        refresh 
    } = useData();
    
    const [exporting, setExporting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filtreNiveau, setFiltreNiveau] = useState('');
    const [filtreClasse, setFiltreClasse] = useState('');
    const [refreshing, setRefreshing] = useState(false);

    // Fonction de rafraîchissement
    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            await refresh();
            notify.success("Données des bulletins actualisées.", { title: "Actualisation réussie" });
        } catch (error) {
            console.error("Erreur actualisation bulletins:", error);
            notify.error("Impossible d'actualiser les bulletins", { title: "Actualisation impossible" });
        } finally {
            setRefreshing(false);
        }
    }, [refresh]);

    const loading = dataLoading || refreshing;

    // Filtrer les notes avec classe_id assignée
    const notesAvecClasse = useMemo(() => {
        return sansPepiniereNotes(notesExamens).filter(note => note.classe_id !== null);
    }, [notesExamens]);

    // Filtrer les participants avec moyenne calculée (notes complètes)
    const participantsAvecNotes = useMemo(() => {
        return notesAvecClasse.filter(note => note.moyenne !== null);
    }, [notesAvecClasse]);

    // Participants sans notes complètes
    const participantsSansNotes = useMemo(() => {
        return notesAvecClasse.filter(note => note.moyenne === null);
    }, [notesAvecClasse]);

    // Appliquer les filtres
    const participantsFiltres = useMemo(() => {
        return participantsAvecNotes.filter(note => {
            const fullName = `${note.inscription?.nom || ''} ${note.inscription?.prenom || ''}`.toLowerCase();
            const matchSearch = fullName.includes(searchTerm.toLowerCase());
            const matchNiveau = !filtreNiveau || note.classe?.niveau === filtreNiveau;
            const matchClasse = !filtreClasse || String(note.classe_id) === filtreClasse;
            return matchSearch && matchNiveau && matchClasse;
        });
    }, [participantsAvecNotes, searchTerm, filtreNiveau, filtreClasse]);

    // Obtenir l'appréciation selon la moyenne
    const getAppreciation = (moyenne) => {
        if (moyenne >= 18) return { text: 'Excellent', color: '#22C55E' };
        if (moyenne >= 16) return { text: 'Très Bien', color: '#22C55E' };
        if (moyenne >= 14) return { text: 'Bien', color: '#3B82F6' };
        if (moyenne >= 12) return { text: 'Assez Bien', color: '#3B82F6' };
        if (moyenne >= 10) return { text: 'Passable', color: '#F97316' };
        return { text: 'Insuffisant', color: '#EF4444' };
    };

    // Calculer le rang d'un participant dans sa classe
    const calculerRang = useCallback((note, participantsAvecNotes) => {
        // Filtrer les participants de la même classe
        const memeClasse = participantsAvecNotes.filter(n => n.classe_id === note.classe_id);
        // Trier par moyenne décroissante
        const triee = [...memeClasse].sort((a, b) => parseFloat(b.moyenne) - parseFloat(a.moyenne));
        // Trouver le rang
        const rang = triee.findIndex(n => n.id === note.id) + 1;
        // Formater le rang
        if (rang === 1) return '1er/ère';
        return `${rang}ème`;
    }, []);

    // Générer le bulletin depuis le modèle fourni.
    const genererBulletin = useCallback(async (note, allParticipants) => {
        setExporting(true);
        try {
            const { createBulletinPdf } = await import("@/lib/bulletinPdf");
            const rank = calculerRang(note, allParticipants || participantsAvecNotes);
            const appreciation = getAppreciation(Number(note.moyenne)).text;
            const { pdf, photoError } = await createBulletinPdf(note, rank, appreciation);
            const fileName = ("bulletin_" + (note.inscription?.nom || "") + "_" + (note.inscription?.prenom || "") + ".pdf").replace(/\s+/g, "_");
            pdf.save(fileName);
            if (photoError) notify.warning("Le bulletin a été généré, mais la photo n'a pas pu être chargée.");
        } catch (err) {
            console.error("Erreur génération bulletin:", err);
            notify.error("Erreur lors de la génération du bulletin", { title: "Export bulletin impossible" });
        } finally {
            setExporting(false);
        }
    }, [participantsAvecNotes, calculerRang]);
    // Générer les bulletins du niveau / de la classe sélectionné(e).
    // Pas d'extraction globale : un filtre niveau ou classe est obligatoire.
    const genererTousBulletins = useCallback(async () => {
        if (!filtreNiveau && !filtreClasse) {
            notify.warning('Sélectionnez un niveau ou une classe pour exporter.', { title: 'Filtre requis' });
            return;
        }
        if (participantsFiltres.length === 0) {
            notify.warning('Aucun participant avec des notes à exporter', { title: 'Export vide' });
            return;
        }

        setExporting(true);
        try {
            for (const note of participantsFiltres) {
                await genererBulletin(note, participantsAvecNotes);
                // Petite pause entre chaque génération
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            notify.success('Tous les bulletins ont été générés.', { title: 'Export terminé' });
        } finally {
            setExporting(false);
        }
    }, [participantsFiltres, genererBulletin, participantsAvecNotes, filtreNiveau, filtreClasse]);

    // Classes uniques pour le filtre
    const classesUniques = useMemo(() => {
        const uniqueClasses = [];
        const seen = new Set();
        notesExamens.forEach(note => {
            if (note.classe && !seen.has(note.classe_id)) {
                seen.add(note.classe_id);
                uniqueClasses.push(note.classe);
            }
        });
        return uniqueClasses.sort((a, b) => a.nom.localeCompare(b.nom));
    }, [notesExamens]);

    if (loading) {
        return (
            <div className="p-4 lg:p-6 flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="p-4 lg:p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-text-main dark:text-white">
                        Gestion des Bulletins
                    </h1>
                    <p className="text-text-secondary mt-1">
                        Générer les bulletins de notes des participants
                        {lastUpdate && (
                            <span className="ml-2 text-xs">
                                • Mis à jour: {lastUpdate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        )}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button 
                        variant="outline"
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="gap-2"
                    >
                        <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                        Actualiser
                    </Button>
                    <Button 
                        onClick={genererTousBulletins}
                        disabled={exporting || participantsFiltres.length === 0 || (!filtreNiveau && !filtreClasse)}
                        className="gap-2"
                    >
                        {exporting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Download className="h-4 w-4" />
                        )}
                        {filtreClasse ? 'Exporter la classe' : filtreNiveau ? 'Exporter le niveau' : 'Exporter (niveau ou classe requis)'}
                    </Button>
                </div>
            </div>

            {/* Statistiques */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                                <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                                <p className="text-sm text-text-secondary">Total participants</p>
                                <p className="text-2xl font-bold text-text-main dark:text-white">
                                    {notesAvecClasse.length}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                            </div>
                            <div>
                                <p className="text-sm text-text-secondary">Notes complètes</p>
                                <p className="text-2xl font-bold text-text-main dark:text-white">
                                    {participantsAvecNotes.length}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                                <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                            </div>
                            <div>
                                <p className="text-sm text-text-secondary">Notes incomplètes</p>
                                <p className="text-2xl font-bold text-text-main dark:text-white">
                                    {participantsSansNotes.length}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                                <FileText className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div>
                                <p className="text-sm text-text-secondary">Bulletins à générer</p>
                                <p className="text-2xl font-bold text-text-main dark:text-white">
                                    {participantsFiltres.length}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filtres */}
            <Card>
                <CardContent className="p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                            <Input
                                placeholder="Rechercher un participant..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9"
                            />
                        </div>

                        <select
                            value={filtreNiveau}
                            onChange={(e) => setFiltreNiveau(e.target.value)}
                            className="px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 dark:border-slate-700"
                        >
                            <option value="">Tous les niveaux</option>
                            <option value="niveau_1">Niveau 1</option>
                            <option value="niveau_2">Niveau 2</option>
                            <option value="niveau_superieur">Niveau Supérieur</option>
                        </select>

                        <select
                            value={filtreClasse}
                            onChange={(e) => setFiltreClasse(e.target.value)}
                            className="px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 dark:border-slate-700"
                        >
                            <option value="">Toutes les classes</option>
                            {classesUniques.map(classe => (
                                <option key={classe.id} value={classe.id}>
                                    {classe.nom}
                                </option>
                            ))}
                        </select>

                        <Button
                            variant="outline"
                            onClick={() => {
                                setSearchTerm('');
                                setFiltreNiveau('');
                                setFiltreClasse('');
                            }}
                            className="gap-2"
                        >
                            <Filter className="h-4 w-4" />
                            Réinitialiser
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Liste des participants */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <GraduationCap className="h-5 w-5" />
                        Participants avec notes complètes ({participantsFiltres.length})
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {participantsFiltres.length === 0 ? (
                        <div className="text-center py-12">
                            <FileText className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                            <p className="text-text-secondary">
                                {participantsAvecNotes.length === 0 
                                    ? 'Aucun participant n\'a encore toutes ses notes (cahiers, conduite, sortie)'
                                    : 'Aucun résultat pour ces filtres'}
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b dark:border-slate-700">
                                        <th className="text-left p-3 text-text-secondary font-medium">Photo</th>
                                        <th className="text-left p-3 text-text-secondary font-medium">Nom & Prénom</th>
                                        <th className="text-left p-3 text-text-secondary font-medium">Classe</th>
                                        <th className="text-left p-3 text-text-secondary font-medium">Entrée</th>
                                        <th className="text-left p-3 text-text-secondary font-medium">Cahiers</th>
                                        <th className="text-left p-3 text-text-secondary font-medium">Conduite</th>
                                        <th className="text-left p-3 text-text-secondary font-medium">Sortie</th>
                                        <th className="text-left p-3 text-text-secondary font-medium">Moyenne</th>
                                        <th className="text-left p-3 text-text-secondary font-medium">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {participantsFiltres.map((note) => {
                                        const moyenne = parseFloat(note.moyenne);
                                        const appreciation = getAppreciation(moyenne);
                                        
                                        return (
                                            <tr 
                                                key={note.id}
                                                className="border-b dark:border-slate-700/50 hover:bg-gray-50 dark:hover:bg-slate-800/50"
                                            >
                                                <td className="p-3">
                                                    {note.inscription?.photo_url ? (
                                                        <LazyImage
                                                            src={note.inscription.photo_url}
                                                            alt={note.inscription?.nom}
                                                            className="w-10 h-10 rounded-full object-cover"
                                                        />
                                                    ) : (
                                                        <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-slate-700 flex items-center justify-center">
                                                            <User className="h-5 w-5 text-gray-400" />
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-3">
                                                    <div className="font-medium text-text-main dark:text-white">
                                                        {note.inscription?.nom} {note.inscription?.prenom}
                                                    </div>
                                                </td>
                                                <td className="p-3">
                                                    <Badge variant={
                                                        note.classe?.niveau === 'niveau_superieur' ? 'success' :
                                                        note.classe?.niveau === 'niveau_3' ? 'default' :
                                                        note.classe?.niveau === 'niveau_2' ? 'warning' :
                                                        'destructive'
                                                    }>
                                                        {note.classe?.nom || '-'}
                                                    </Badge>
                                                </td>
                                                <td className="p-3 text-text-main dark:text-white">
                                                    {parseFloat(note.note_entree)?.toFixed(1) || '-'}
                                                </td>
                                                <td className="p-3 text-text-main dark:text-white">
                                                    {parseFloat(note.note_cahiers)?.toFixed(1) || '-'}
                                                </td>
                                                <td className="p-3 text-text-main dark:text-white">
                                                    {parseFloat(note.note_conduite)?.toFixed(1) || '-'}
                                                </td>
                                                <td className="p-3 text-text-main dark:text-white">
                                                    {parseFloat(note.note_sortie)?.toFixed(1) || '-'}
                                                </td>
                                                <td className="p-3">
                                                    <span 
                                                        className="font-bold"
                                                        style={{ color: appreciation.color }}
                                                    >
                                                        {moyenne.toFixed(2)}
                                                    </span>
                                                </td>
                                                <td className="p-3">
                                                    <Button
                                                        size="sm"
                                                        onClick={() => genererBulletin(note, participantsAvecNotes)}
                                                        disabled={exporting}
                                                        className="gap-1"
                                                    >
                                                        <Download className="h-3 w-3" />
                                                        Bulletin
                                                    </Button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
