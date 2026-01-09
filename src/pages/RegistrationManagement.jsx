import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { RegistrationDetailsModal } from "@/components/RegistrationDetailsModal";
import {
    Search,
    Plus,
    Download,
    Edit,
    Trash2,
    RefreshCw,
    ChevronLeft,
    ChevronRight,
    X,
    Eye,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useData } from "@/contexts";

// Configuration des statuts (mapping DB -> UI)
const statusConfig = {
    en_attente: { label: "En attente", variant: "warning" },
    valide: { label: "Validé", variant: "success" },
    rejete: { label: "Rejeté", variant: "destructive" },
};

// Mapping des niveaux d'étude
const niveauEtudeMap = {
    aucun: "Aucun",
    primaire: "Primaire",
    secondaire: "Secondaire",
    superieur: "Universitaire",
    arabe: "Arabe",
};

export function RegistrationManagement() {
    // Utiliser le DataContext global au lieu de charger localement
    const { 
        inscriptions, 
        chefsQuartier, 
        dortoirs, 
        loading, 
        refresh,
        updateInscriptionLocal,
        deleteInscriptionLocal 
    } = useData();
    
    const [searchTerm, setSearchTerm] = useState("");
    const [filters, setFilters] = useState({
        statut: "",
        chefQuartier: "",
        niveau: "",
        sexe: "",
    });
    const [editModal, setEditModal] = useState({ open: false, registration: null });
    const [deleteModal, setDeleteModal] = useState({ open: false, registration: null });

    // Fonction pour formater une inscription
    const formatRegistration = useCallback((row) => ({
        id: row.id,
        reference_id: row.reference_id || 'N/A',
        nom: row.nom,
        prenom: row.prenom,
        age: row.age,
        sexe: row.sexe === 'homme' ? 'H' : 'F',
        sexeRaw: row.sexe,
        niveau: niveauEtudeMap[row.niveau_etude] || row.niveau_etude,
        chefQuartier: row.chef_quartier
            ? `${row.chef_quartier.nom_complet} (${row.chef_quartier.zone})`
            : 'Inscription Présentielle',
        statut: row.statut,
        date: new Date(row.created_at).toLocaleDateString('fr-FR'),
        dateTime: new Date(row.created_at).toLocaleString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }),
        type_inscription: row.type_inscription,
        originalData: row,
    }), []);

    // Formater les inscriptions depuis le DataContext
    const registrations = useMemo(() => {
        return inscriptions.map(formatRegistration);
    }, [inscriptions, formatRegistration]);

    // Filtrer les inscriptions
    const filteredRegistrations = useMemo(() => {
        return registrations.filter((r) => {
            const matchesSearch =
                r.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
                r.prenom.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesStatus = !filters.statut || r.statut === filters.statut;
            const matchesChef = !filters.chefQuartier || r.chefQuartier.includes(filters.chefQuartier);
            const matchesNiveau = !filters.niveau || r.niveau === filters.niveau;
            const matchesSexe = !filters.sexe || r.sexe === filters.sexe;
            return matchesSearch && matchesStatus && matchesChef && matchesNiveau && matchesSexe;
        });
    }, [registrations, searchTerm, filters]);

    const handleValidateOne = async (id) => {
        try {
            const { error } = await supabase
                .from('inscriptions')
                .update({ statut: 'valide' })
                .eq('id', id);

            if (error) throw error;

            // Mise à jour optimiste locale
            updateInscriptionLocal(id, { statut: 'valide' });
        } catch (error) {
            console.error('Erreur validation:', error);
            alert('Erreur lors de la validation de l\'inscription');
        }
    };

    const handleDelete = async (id) => {
        try {
            const { error } = await supabase
                .from('inscriptions')
                .delete()
                .eq('id', id);

            if (error) throw error;

            // Mise à jour optimiste locale
            deleteInscriptionLocal(id);
            setDeleteModal({ open: false, registration: null });
            setEditModal({ open: false, registration: null });
        } catch (error) {
            console.error('Erreur suppression:', error);
            alert('Erreur lors de la suppression de l\'inscription');
            setDeleteModal({ open: false, registration: null });
        }
    };

    const handleUpdate = async (id, formData, closeModal = true) => {
        try {
            const updateData = {
                nom: formData.nom,
                prenom: formData.prenom,
                age: parseInt(formData.age),
                sexe: formData.sexe,
                niveau_etude: formData.niveau_etude,
                telephone: formData.telephone || null,
                chef_quartier_id: formData.chef_quartier_id || null,
                statut: formData.statut,
                dortoir_id: formData.dortoir_id || null,
                niveau_formation: formData.niveau_formation || null,
            };

            const { error } = await supabase
                .from('inscriptions')
                .update(updateData)
                .eq('id', id);

            if (error) throw error;

            // Mise à jour optimiste locale
            updateInscriptionLocal(id, updateData);

            // Fermer le modal seulement si demandé
            if (closeModal) {
                setEditModal({ open: false, registration: null });
            }
        } catch (error) {
            console.error('Erreur mise à jour:', error);
            alert('Erreur lors de la mise à jour de l\'inscription');
        }
    };

    // Rafraîchissement via le DataContext
    const handleRefresh = useCallback(() => {
        refresh();
    }, [refresh]);

    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Header */}
            <header className="bg-surface-light dark:bg-surface-dark border-b border-border-light dark:border-border-dark py-4 px-8 flex justify-between items-center z-10 flex-shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-text-main dark:text-white tracking-tight">
                        Gestion des Inscriptions
                    </h1>
                    <p className="text-sm text-text-secondary dark:text-gray-400 mt-1">
                        Gérez, filtrez et validez les inscriptions au séminaire.
                    </p>
                </div>
                <div className="flex gap-3">
                    <Button
                        variant="outline"
                        onClick={handleRefresh}
                        disabled={loading}
                        className="gap-2"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                        Actualiser
                    </Button>
                    <Button className="gap-2">
                        <Plus className="h-4 w-4" />
                        Ajouter une inscription
                    </Button>
                </div>
            </header>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-8">
                <div className="max-w-[1400px] mx-auto space-y-6">
                    {/* Filters */}
                    <Card className="p-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                            {/* Search */}
                            <div className="lg:col-span-2 xl:col-span-1">
                                <Label className="mb-1.5 block text-xs">Recherche</Label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
                                    <Input
                                        placeholder="Nom ou prénom..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-10"
                                    />
                                </div>
                            </div>

                            {/* Status Filter */}
                            <div>
                                <Label className="mb-1.5 block text-xs">Statut</Label>
                                <Select
                                    value={filters.statut}
                                    onChange={(e) => setFilters({ ...filters, statut: e.target.value })}
                                >
                                    <option value="">Tous les statuts</option>
                                    <option value="en_attente">En attente</option>
                                    <option value="valide">Validé</option>
                                    <option value="rejete">Rejeté</option>
                                </Select>
                            </div>

                            {/* Président de section Filter */}
                            <div>
                                <Label className="mb-1.5 block text-xs">Président de section</Label>
                                <Select
                                    value={filters.chefQuartier}
                                    onChange={(e) => setFilters({ ...filters, chefQuartier: e.target.value })}
                                >
                                    <option value="">Tous les chefs</option>
                                    {chefsQuartier.map(chef => (
                                        <option key={chef.id} value={chef.nom_complet}>
                                            {chef.nom_complet} ({chef.zone})
                                        </option>
                                    ))}
                                </Select>
                            </div>

                            {/* Niveau Filter */}
                            <div>
                                <Label className="mb-1.5 block text-xs">Niveau d'étude</Label>
                                <Select
                                    value={filters.niveau}
                                    onChange={(e) => setFilters({ ...filters, niveau: e.target.value })}
                                >
                                    <option value="">Tous les niveaux</option>
                                    <option value="Aucun">Aucun</option>
                                    <option value="Primaire">Primaire</option>
                                    <option value="Secondaire">Secondaire</option>
                                    <option value="Universitaire">Universitaire</option>
                                    <option value="Arabe">Arabe</option>
                                </Select>
                            </div>

                            {/* Sexe Filter */}
                            <div>
                                <Label className="mb-1.5 block text-xs">Genre</Label>
                                <Select
                                    value={filters.sexe}
                                    onChange={(e) => setFilters({ ...filters, sexe: e.target.value })}
                                >
                                    <option value="">Tous</option>
                                    <option value="H">Homme</option>
                                    <option value="F">Femme</option>
                                </Select>
                            </div>
                        </div>
                    </Card>

                    {/* Actions Bar */}
                    <div className="flex items-center justify-between">
                        <div className="text-sm text-text-secondary dark:text-gray-400">
                            <span className="font-medium text-text-main dark:text-white">
                                {filteredRegistrations.length}
                            </span>{" "}
                            inscriptions trouvées
                        </div>
                        <div className="flex gap-3">
                            <Button variant="outline" className="gap-2">
                                <Download className="h-4 w-4" />
                                Export Excel
                            </Button>
                        </div>
                    </div>

                    {/* Data Table */}
                    <Card className="overflow-hidden">
                        {loading && !registrations.length ? (
                            <div className="flex flex-col items-center justify-center py-16">
                                <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
                                <p className="text-text-secondary dark:text-gray-400">Chargement des inscriptions...</p>
                            </div>
                        ) : filteredRegistrations.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16">
                                <p className="text-text-secondary dark:text-gray-400 text-lg mb-2">Aucune inscription trouvée</p>
                                <p className="text-text-secondary dark:text-gray-500 text-sm">
                                    {registrations.length === 0
                                        ? "Les inscriptions apparaîtront ici une fois soumises."
                                        : "Essayez de modifier vos filtres de recherche."
                                    }
                                </p>
                            </div>
                        ) : (
                            <>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm border-collapse">
                                        <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-border-light dark:border-border-dark">
                                            <tr>
                                                <th className="p-4 font-semibold text-text-main dark:text-white">ID</th>
                                                <th className="p-4 font-semibold text-text-main dark:text-white">Photo</th>
                                                <th className="p-4 font-semibold text-text-main dark:text-white">Nom</th>
                                                <th className="p-4 font-semibold text-text-main dark:text-white">Prénoms</th>
                                                <th className="p-4 font-semibold text-text-main dark:text-white">Âge</th>
                                                <th className="p-4 font-semibold text-text-main dark:text-white">Genre</th>
                                                <th className="p-4 font-semibold text-text-main dark:text-white">Niveau</th>
                                                <th className="p-4 font-semibold text-text-main dark:text-white">
                                                    Président de section
                                                </th>
                                                <th className="p-4 font-semibold text-text-main dark:text-white">Statut</th>
                                                <th className="p-4 font-semibold text-text-main dark:text-white">Date</th>
                                                <th className="p-4 font-semibold text-text-main dark:text-white text-right">
                                                    Actions
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border-light dark:divide-border-dark">
                                            {filteredRegistrations.map((registration) => (
                                                <tr
                                                    key={registration.id}
                                                    className={`group hover:opacity-90 transition-colors ${
                                                        registration.sexeRaw === 'homme'
                                                            ? 'bg-blue-50/40 dark:bg-blue-900/10'
                                                            : 'bg-pink-50/40 dark:bg-pink-900/10'
                                                    }`}
                                                >
                                                    <td className="p-4 font-mono text-sm font-semibold text-primary">
                                                        {registration.reference_id}
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                                                            {registration.originalData?.photo_url ? (
                                                                <img
                                                                    src={registration.originalData.photo_url}
                                                                    alt={`${registration.nom} ${registration.prenom}`}
                                                                    className="w-full h-full object-cover"
                                                                />
                                                            ) : (
                                                                <span className="text-lg text-gray-400">
                                                                    {registration.nom?.charAt(0)?.toUpperCase() || '?'}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="p-4 font-medium text-text-main dark:text-white">
                                                        {registration.nom}
                                                    </td>
                                                    <td className="p-4 text-text-secondary dark:text-gray-300">
                                                        {registration.prenom}
                                                    </td>
                                                    <td className="p-4 text-text-secondary dark:text-gray-300">
                                                        {registration.age}
                                                    </td>
                                                    <td className="p-4 text-text-secondary dark:text-gray-300">
                                                        {registration.sexe}
                                                    </td>
                                                    <td className="p-4 text-text-secondary dark:text-gray-300">
                                                        {registration.niveau}
                                                    </td>
                                                    <td className="p-4 text-text-secondary dark:text-gray-300">
                                                        {registration.chefQuartier}
                                                    </td>
                                                    <td className="p-4">
                                                        <Badge variant={statusConfig[registration.statut]?.variant || 'secondary'}>
                                                            {statusConfig[registration.statut]?.label || registration.statut}
                                                        </Badge>
                                                    </td>
                                                    <td className="p-4 text-text-secondary dark:text-gray-400 text-xs">
                                                        {registration.dateTime}
                                                    </td>
                                                    <td className="p-4 text-right">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => setEditModal({ open: true, registration })}
                                                            className="gap-2"
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                            Voir détails
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Pagination */}
                                <div className="bg-surface-light dark:bg-surface-dark px-4 py-3 flex items-center justify-between border-t border-border-light dark:border-border-dark">
                                    <div>
                                        <p className="text-sm text-text-secondary dark:text-gray-400">
                                            Affichage de{" "}
                                            <span className="font-medium text-text-main dark:text-white">1</span> à{" "}
                                            <span className="font-medium text-text-main dark:text-white">
                                                {filteredRegistrations.length}
                                            </span>{" "}
                                            sur{" "}
                                            <span className="font-medium text-text-main dark:text-white">
                                                {registrations.length}
                                            </span>{" "}
                                            résultats
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button variant="outline" size="sm" disabled>
                                            <ChevronLeft className="h-4 w-4 mr-1" />
                                            Précédent
                                        </Button>
                                        <Button variant="outline" size="sm" disabled>
                                            Suivant
                                            <ChevronRight className="h-4 w-4 ml-1" />
                                        </Button>
                                    </div>
                                </div>
                            </>
                        )}
                    </Card>
                </div>
            </div>

            {/* Details/Edit Modal */}
            <RegistrationDetailsModal
                isOpen={editModal.open}
                onClose={() => setEditModal({ open: false, registration: null })}
                registration={editModal.registration}
                onValidate={handleValidateOne}
                onDelete={(id) => {
                    setEditModal({ open: false, registration: null });
                    setDeleteModal({ open: true, registration: editModal.registration });
                }}
                onUpdate={handleUpdate}
                chefsQuartier={chefsQuartier}
                dortoirs={dortoirs}
                statusConfig={statusConfig}
            />

            {/* Delete Confirmation Modal */}
            {deleteModal.open && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-md p-6 animate-fade-in">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="text-lg font-bold text-text-main dark:text-white">
                                Confirmer la suppression
                            </h3>
                            <button
                                onClick={() => setDeleteModal({ open: false, registration: null })}
                                className="text-text-secondary hover:text-text-main dark:hover:text-white"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <p className="text-text-secondary dark:text-gray-400 mb-6">
                            Êtes-vous sûr de vouloir supprimer l'inscription de{" "}
                            <span className="font-medium text-text-main dark:text-white">
                                {deleteModal.registration?.nom} {deleteModal.registration?.prenom}
                            </span>{" "}
                            ?
                        </p>
                        <div className="flex gap-3 justify-end">
                            <Button
                                variant="outline"
                                onClick={() => setDeleteModal({ open: false, registration: null })}
                            >
                                Annuler
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={() => handleDelete(deleteModal.registration?.id)}
                            >
                                Supprimer
                            </Button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
}
