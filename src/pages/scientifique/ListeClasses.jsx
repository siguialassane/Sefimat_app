import { useState, useMemo, useCallback, useRef } from "react";
import { Download, Users, Filter, FileText, User, Eye, X, Phone, MapPin, School, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { useData } from "@/contexts";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export function ListeClasses() {
    const { notesExamens, classes, dortoirs, inscriptions } = useData();

    const [filterNiveau, setFilterNiveau] = useState("all");
    const [filterClasse, setFilterClasse] = useState("all");
    const [exporting, setExporting] = useState(false);
    const [selectedParticipant, setSelectedParticipant] = useState(null);
    const tableRef = useRef(null);

    // Obtenir les classes filtrées
    const classesFiltrees = useMemo(() => {
        return classes.filter(classe => {
            if (filterNiveau !== 'all' && classe.niveau !== filterNiveau) {
                return false;
            }
            if (filterClasse !== 'all' && classe.id !== filterClasse) {
                return false;
            }
            return true;
        });
    }, [classes, filterNiveau, filterClasse]);

    // Obtenir les participants par classe
    const participantsParClasse = useMemo(() => {
        const result = {};
        classesFiltrees.forEach(classe => {
            result[classe.id] = notesExamens
                .filter(note => note.classe_id === classe.id)
                .map(note => ({
                    ...note,
                    inscription: inscriptions.find(i => i.id === note.inscription_id) || note.inscription
                }))
                .sort((a, b) => {
                    const nomA = a.inscription?.nom || '';
                    const nomB = b.inscription?.nom || '';
                    return nomA.localeCompare(nomB);
                });
        });
        return result;
    }, [classesFiltrees, notesExamens, inscriptions]);

    // Obtenir le nom du dortoir
    const getDortoirNom = useCallback((dortoirId) => {
        const dortoir = dortoirs.find(d => d.id === dortoirId);
        return dortoir?.nom || '-';
    }, [dortoirs]);

    // Exporter une classe en PDF
    const exportClassePDF = useCallback(async (classe) => {
        setExporting(true);
        try {
            const participants = participantsParClasse[classe.id] || [];

            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth();

            // Titre
            pdf.setFontSize(18);
            pdf.setFont('helvetica', 'bold');
            pdf.text(`SEFIMAP - Liste ${classe.nom}`, pageWidth / 2, 20, { align: 'center' });

            // Date
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'normal');
            const date = new Date().toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric'
            });
            pdf.text(`Généré le ${date}`, pageWidth / 2, 28, { align: 'center' });

            // Info classe
            pdf.setFontSize(12);
            pdf.text(`Effectif: ${participants.length} participant(s)`, 14, 40);

            // En-têtes tableau
            let y = 50;
            pdf.setFillColor(59, 130, 246);
            pdf.rect(14, y, pageWidth - 28, 8, 'F');
            pdf.setTextColor(255, 255, 255);
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'bold');
            pdf.text('N°', 18, y + 6);
            pdf.text('Nom & Prénom', 30, y + 6);
            pdf.text('Note Entrée', 100, y + 6);
            pdf.text('Dortoir', 130, y + 6);
            pdf.text('Sexe', 170, y + 6);

            // Données
            y += 10;
            pdf.setTextColor(0, 0, 0);
            pdf.setFont('helvetica', 'normal');

            participants.forEach((participant, index) => {
                if (y > 270) {
                    pdf.addPage();
                    y = 20;
                }

                // Alternance couleur
                if (index % 2 === 0) {
                    pdf.setFillColor(243, 244, 246);
                    pdf.rect(14, y - 4, pageWidth - 28, 8, 'F');
                }

                pdf.text(`${index + 1}`, 18, y + 2);
                pdf.text(`${participant.inscription?.nom || ''} ${participant.inscription?.prenom || ''}`, 30, y + 2);
                pdf.text(`${participant.note_entree?.toFixed(1) || '-'}`, 100, y + 2);
                pdf.text(getDortoirNom(participant.inscription?.dortoir_id), 130, y + 2);
                pdf.text(participant.inscription?.sexe === 'homme' ? 'H' : 'F', 170, y + 2);

                y += 8;
            });

            // Pied de page
            const pageCount = pdf.internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                pdf.setPage(i);
                pdf.setFontSize(8);
                pdf.setTextColor(128, 128, 128);
                pdf.text(`Page ${i}/${pageCount}`, pageWidth / 2, 290, { align: 'center' });
            }

            pdf.save(`liste_${classe.nom.replace(/\s+/g, '_')}.pdf`);
        } catch (err) {
            console.error('Erreur export PDF:', err);
            alert('Erreur lors de l\'export PDF');
        } finally {
            setExporting(false);
        }
    }, [participantsParClasse, getDortoirNom]);

    // Exporter toutes les classes
    const exportToutPDF = useCallback(async () => {
        setExporting(true);
        try {
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth();
            let isFirstPage = true;

            for (const classe of classesFiltrees) {
                const participants = participantsParClasse[classe.id] || [];
                if (participants.length === 0) continue;

                if (!isFirstPage) {
                    pdf.addPage();
                }
                isFirstPage = false;

                // Titre
                pdf.setFontSize(16);
                pdf.setFont('helvetica', 'bold');
                pdf.setTextColor(0, 0, 0);
                pdf.text(`${classe.nom}`, pageWidth / 2, 20, { align: 'center' });

                // Effectif
                pdf.setFontSize(10);
                pdf.setFont('helvetica', 'normal');
                pdf.text(`Effectif: ${participants.length}`, 14, 30);

                // Tableau
                let y = 40;
                pdf.setFillColor(59, 130, 246);
                pdf.rect(14, y, pageWidth - 28, 7, 'F');
                pdf.setTextColor(255, 255, 255);
                pdf.setFontSize(9);
                pdf.setFont('helvetica', 'bold');
                pdf.text('N°', 18, y + 5);
                pdf.text('Nom & Prénom', 30, y + 5);
                pdf.text('Note', 110, y + 5);
                pdf.text('Dortoir', 130, y + 5);

                y += 9;
                pdf.setTextColor(0, 0, 0);
                pdf.setFont('helvetica', 'normal');

                participants.forEach((participant, index) => {
                    if (y > 275) {
                        pdf.addPage();
                        y = 20;
                    }

                    if (index % 2 === 0) {
                        pdf.setFillColor(243, 244, 246);
                        pdf.rect(14, y - 3, pageWidth - 28, 7, 'F');
                    }

                    pdf.text(`${index + 1}`, 18, y + 2);
                    pdf.text(`${participant.inscription?.nom || ''} ${participant.inscription?.prenom || ''}`.substring(0, 40), 30, y + 2);
                    pdf.text(`${participant.note_entree?.toFixed(1) || '-'}`, 110, y + 2);
                    pdf.text(getDortoirNom(participant.inscription?.dortoir_id).substring(0, 20), 130, y + 2);

                    y += 7;
                });
            }

            // Date en première page
            pdf.setPage(1);
            pdf.setFontSize(10);
            pdf.setTextColor(128, 128, 128);
            const date = new Date().toLocaleDateString('fr-FR');
            pdf.text(`SEFIMAP - Généré le ${date}`, pageWidth / 2, 10, { align: 'center' });

            pdf.save('liste_toutes_classes.pdf');
        } catch (err) {
            console.error('Erreur export PDF:', err);
            alert('Erreur lors de l\'export PDF');
        } finally {
            setExporting(false);
        }
    }, [classesFiltrees, participantsParClasse, getDortoirNom]);

    const niveauLabels = {
        debutant: { label: 'Débutant', color: 'destructive' },
        moyen: { label: 'Moyen', color: 'warning' },
        superieur: { label: 'Supérieur', color: 'success' },
    };

    return (
        <div className="p-4 lg:p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-text-main dark:text-white">
                        Liste des classes
                    </h1>
                    <p className="text-text-secondary mt-1">
                        Visualiser et exporter les listes par classe
                    </p>
                </div>
                <Button
                    onClick={exportToutPDF}
                    disabled={exporting || classesFiltrees.length === 0}
                >
                    <Download className="h-4 w-4 mr-2" />
                    {exporting ? 'Export...' : 'Exporter tout (PDF)'}
                </Button>
            </div>

            {/* Filtres */}
            <div className="flex flex-wrap gap-4">
                <Select
                    value={filterNiveau}
                    onValueChange={setFilterNiveau}
                >
                    <option value="all">Tous les niveaux</option>
                    <option value="debutant">Débutant</option>
                    <option value="moyen">Moyen</option>
                    <option value="superieur">Supérieur</option>
                </Select>
                <Select
                    value={filterClasse}
                    onValueChange={setFilterClasse}
                >
                    <option value="all">Toutes les classes</option>
                    {classes.map(classe => (
                        <option key={classe.id} value={classe.id}>
                            {classe.nom}
                        </option>
                    ))}
                </Select>
            </div>

            {/* Liste des classes */}
            {classesFiltrees.length === 0 ? (
                <Card>
                    <CardContent className="py-12">
                        <div className="text-center">
                            <Users className="h-12 w-12 text-text-secondary mx-auto mb-4" />
                            <p className="text-text-secondary">Aucune classe à afficher</p>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-6" ref={tableRef}>
                    {classesFiltrees.map(classe => {
                        const participants = participantsParClasse[classe.id] || [];

                        return (
                            <Card key={classe.id}>
                                <CardHeader>
                                    <CardTitle className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <Badge variant={niveauLabels[classe.niveau]?.color || 'default'}>
                                                {classe.nom}
                                            </Badge>
                                            <span className="text-sm text-text-secondary font-normal">
                                                {participants.length} / {classe.capacite} places
                                            </span>
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => exportClassePDF(classe)}
                                            disabled={exporting || participants.length === 0}
                                        >
                                            <FileText className="h-4 w-4 mr-2" />
                                            PDF
                                        </Button>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {participants.length === 0 ? (
                                        <p className="text-center text-text-secondary py-4">
                                            Aucun participant dans cette classe
                                        </p>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full">
                                                <thead>
                                                    <tr className="border-b border-border-light dark:border-border-dark">
                                                        <th className="text-left py-2 px-3 text-sm font-medium text-text-secondary">N°</th>
                                                        <th className="text-left py-2 px-3 text-sm font-medium text-text-secondary">Participant</th>
                                                        <th className="text-center py-2 px-3 text-sm font-medium text-text-secondary">Note entrée</th>
                                                        <th className="text-left py-2 px-3 text-sm font-medium text-text-secondary">Dortoir</th>
                                                        <th className="text-center py-2 px-3 text-sm font-medium text-text-secondary">Sexe</th>
                                                        <th className="text-center py-2 px-3 text-sm font-medium text-text-secondary">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {participants.map((participant, index) => (
                                                        <tr
                                                            key={participant.id}
                                                            className="border-b border-border-light dark:border-border-dark last:border-0"
                                                        >
                                                            <td className="py-2 px-3 text-text-secondary">
                                                                {index + 1}
                                                            </td>
                                                            <td className="py-2 px-3">
                                                                <div className="flex items-center gap-2">
                                                                    {participant.inscription?.photo_url ? (
                                                                        <img
                                                                            src={participant.inscription.photo_url}
                                                                            alt=""
                                                                            className="h-8 w-8 rounded-full object-cover"
                                                                        />
                                                                    ) : (
                                                                        <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                                                                            <User className="h-4 w-4 text-blue-600" />
                                                                        </div>
                                                                    )}
                                                                    <span className="font-medium text-text-main dark:text-white">
                                                                        {participant.inscription?.nom} {participant.inscription?.prenom}
                                                                    </span>
                                                                </div>
                                                            </td>
                                                            <td className="py-2 px-3 text-center font-medium text-text-main dark:text-white">
                                                                {participant.note_entree?.toFixed(1) || '-'}
                                                            </td>
                                                            <td className="py-2 px-3 text-text-main dark:text-white">
                                                                {getDortoirNom(participant.inscription?.dortoir_id)}
                                                            </td>
                                                            <td className="py-2 px-3 text-center">
                                                                <Badge variant={participant.inscription?.sexe === 'homme' ? 'default' : 'secondary'}>
                                                                    {participant.inscription?.sexe === 'homme' ? 'H' : 'F'}
                                                                </Badge>
                                                            </td>
                                                            <td className="py-2 px-3 text-center">
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => setSelectedParticipant(participant)}
                                                                >
                                                                    <Eye className="h-4 w-4" />
                                                                </Button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Modal Détail Participant */}
            {selectedParticipant && (
                <>
                    <div
                        className="fixed inset-0 bg-black/50 z-40"
                        onClick={() => setSelectedParticipant(null)}
                    />
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="bg-surface-light dark:bg-surface-dark rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                            {/* Header */}
                            <div className="flex items-center justify-between p-4 border-b border-border-light dark:border-border-dark">
                                <h3 className="text-lg font-bold text-text-main dark:text-white">
                                    Détails du participant
                                </h3>
                                <button
                                    onClick={() => setSelectedParticipant(null)}
                                    className="text-text-secondary hover:text-text-main dark:hover:text-white"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="p-4 space-y-4">
                                {/* Photo et nom */}
                                <div className="flex items-center gap-4">
                                    {selectedParticipant.inscription?.photo_url ? (
                                        <img
                                            src={selectedParticipant.inscription.photo_url}
                                            alt=""
                                            className="h-20 w-20 rounded-full object-cover"
                                        />
                                    ) : (
                                        <div className="h-20 w-20 rounded-full bg-blue-500/10 flex items-center justify-center">
                                            <User className="h-10 w-10 text-blue-600" />
                                        </div>
                                    )}
                                    <div>
                                        <h4 className="text-xl font-bold text-text-main dark:text-white">
                                            {selectedParticipant.inscription?.nom} {selectedParticipant.inscription?.prenom}
                                        </h4>
                                        <div className="flex gap-2 mt-1">
                                            <Badge variant={selectedParticipant.inscription?.sexe === 'homme' ? 'default' : 'secondary'}>
                                                {selectedParticipant.inscription?.sexe === 'homme' ? 'Homme' : 'Femme'}
                                            </Badge>
                                            <Badge variant={niveauLabels[selectedParticipant.niveau_attribue]?.color || 'default'}>
                                                {selectedParticipant.classe?.nom}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>

                                {/* Infos personnelles */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="h-4 w-4 text-text-secondary" />
                                        <div>
                                            <p className="text-xs text-text-secondary">Âge</p>
                                            <p className="font-medium text-text-main dark:text-white">
                                                {selectedParticipant.inscription?.age} ans
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <School className="h-4 w-4 text-text-secondary" />
                                        <div>
                                            <p className="text-xs text-text-secondary">École</p>
                                            <p className="font-medium text-text-main dark:text-white">
                                                {selectedParticipant.inscription?.ecole || '-'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <MapPin className="h-4 w-4 text-text-secondary" />
                                        <div>
                                            <p className="text-xs text-text-secondary">Dortoir</p>
                                            <p className="font-medium text-text-main dark:text-white">
                                                {getDortoirNom(selectedParticipant.inscription?.dortoir_id)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Phone className="h-4 w-4 text-text-secondary" />
                                        <div>
                                            <p className="text-xs text-text-secondary">Téléphone</p>
                                            <p className="font-medium text-text-main dark:text-white">
                                                {selectedParticipant.inscription?.telephone || '-'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Notes */}
                                <div className="pt-4 border-t border-border-light dark:border-border-dark">
                                    <h5 className="font-semibold text-text-main dark:text-white mb-3">Notes</h5>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="p-3 rounded-lg bg-gray-100 dark:bg-white/5">
                                            <p className="text-xs text-text-secondary">Note d'entrée</p>
                                            <p className="text-lg font-bold text-text-main dark:text-white">
                                                {selectedParticipant.note_entree?.toFixed(1) || '-'} /20
                                            </p>
                                        </div>
                                        <div className="p-3 rounded-lg bg-gray-100 dark:bg-white/5">
                                            <p className="text-xs text-text-secondary">Note cahiers</p>
                                            <p className="text-lg font-bold text-text-main dark:text-white">
                                                {selectedParticipant.note_cahiers?.toFixed(1) || '-'} /20
                                            </p>
                                        </div>
                                        <div className="p-3 rounded-lg bg-gray-100 dark:bg-white/5">
                                            <p className="text-xs text-text-secondary">Note conduite</p>
                                            <p className="text-lg font-bold text-text-main dark:text-white">
                                                {selectedParticipant.note_conduite?.toFixed(1) || '-'} /20
                                            </p>
                                        </div>
                                        <div className="p-3 rounded-lg bg-gray-100 dark:bg-white/5">
                                            <p className="text-xs text-text-secondary">Note sortie</p>
                                            <p className="text-lg font-bold text-text-main dark:text-white">
                                                {selectedParticipant.note_sortie?.toFixed(1) || '-'} /20
                                            </p>
                                        </div>
                                    </div>

                                    {/* Moyenne */}
                                    {selectedParticipant.moyenne && (
                                        <div className="mt-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                                            <p className="text-xs text-blue-600 dark:text-blue-400">Moyenne générale</p>
                                            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                                                {parseFloat(selectedParticipant.moyenne).toFixed(2)} /20
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Infos parent */}
                                {(selectedParticipant.inscription?.nom_parent || selectedParticipant.inscription?.numero_parent) && (
                                    <div className="pt-4 border-t border-border-light dark:border-border-dark">
                                        <h5 className="font-semibold text-text-main dark:text-white mb-3">Parent/Tuteur</h5>
                                        <div className="space-y-2">
                                            {selectedParticipant.inscription?.nom_parent && (
                                                <p className="text-text-main dark:text-white">
                                                    {selectedParticipant.inscription.nom_parent} {selectedParticipant.inscription.prenom_parent}
                                                </p>
                                            )}
                                            {selectedParticipant.inscription?.numero_parent && (
                                                <p className="text-text-secondary flex items-center gap-2">
                                                    <Phone className="h-4 w-4" />
                                                    {selectedParticipant.inscription.numero_parent}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="p-4 border-t border-border-light dark:border-border-dark">
                                <Button
                                    variant="outline"
                                    className="w-full"
                                    onClick={() => setSelectedParticipant(null)}
                                >
                                    Fermer
                                </Button>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
