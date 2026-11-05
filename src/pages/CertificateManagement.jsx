import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Search } from "lucide-react";
import { useData } from "@/contexts";
import { supabase } from "@/lib/supabase";
import { isInSecretariatScope } from "@/lib/secretariat";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { notify } from "@/components/ui/toast";

export function CertificateManagement() {
    const { inscriptions } = useData();
    const [type, setType] = useState("participant");
    const [members, setMembers] = useState([]);
    const [search, setSearch] = useState("");
    const [selectedId, setSelectedId] = useState(null);
    const [generating, setGenerating] = useState(false);
    const certificateRef = useRef(null);

    useEffect(() => {
        let active = true;
        supabase.from("membres_organisation").select("id,nom,prenom,commission").order("nom").then(({ data, error }) => {
            if (!active) return;
            if (error) notify.error("Impossible de charger les membres.");
            else setMembers(data || []);
        });
        return () => { active = false; };
    }, []);

    const people = useMemo(() => type === "membre"
        ? members
        : inscriptions.filter((item) => item.statut === "valide" && isInSecretariatScope(item)), [type, members, inscriptions]);
    const filtered = people.filter((person) => ((person.nom || "") + " " + (person.prenom || "")).toLocaleLowerCase("fr").includes(search.toLocaleLowerCase("fr")));
    const selected = people.find((person) => person.id === selectedId);
    const fullName = selected ? ((selected.nom || "") + " " + (selected.prenom || "")).trim().toLocaleUpperCase("fr") : "";
    const fontSize = Math.max(0.25, Math.min(5.7, 105 / Math.max(fullName.length, 1)));

    const changeType = (next) => { setType(next); setSelectedId(null); setSearch(""); };
    const download = async () => {
        if (!selected || !certificateRef.current) return;
        setGenerating(true);
        try {
            const image = certificateRef.current.querySelector("img");
            if (image && !image.complete) await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; });
            const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
            const canvas = await html2canvas(certificateRef.current, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
            const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
            pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, 297, 210);
            pdf.save("certificat-" + type + "-" + fullName.replace(/[^\p{L}\p{N}]+/gu, "-") + ".pdf");
        } catch (error) {
            notify.error(error.message || "Impossible de générer le certificat.");
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
            <header>
                <h1 className="text-2xl md:text-3xl font-bold text-text-main dark:text-white">Certificats</h1>
                <p className="mt-1 text-sm text-text-secondary">Sélectionnez une personne pour prévisualiser et télécharger son certificat.</p>
            </header>
            <div className="flex gap-2 border-b border-border-light dark:border-border-dark" role="tablist" aria-label="Type de certificat">
                <button type="button" role="tab" aria-selected={type === "participant"} onClick={() => changeType("participant")} className={"px-4 py-3 text-sm font-semibold border-b-2 " + (type === "participant" ? "border-primary text-primary" : "border-transparent text-text-secondary")}>Participants</button>
                <button type="button" role="tab" aria-selected={type === "membre"} onClick={() => changeType("membre")} className={"px-4 py-3 text-sm font-semibold border-b-2 " + (type === "membre" ? "border-primary text-primary" : "border-transparent text-text-secondary")}>Membres</button>
            </div>
            <div className="grid lg:grid-cols-[minmax(240px,1fr)_minmax(0,2fr)] gap-6">
                <Card className="overflow-hidden">
                    <div className="p-4 border-b border-border-light dark:border-border-dark">
                        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" /><Input className="pl-10" placeholder="Rechercher un nom..." value={search} onChange={(event) => setSearch(event.target.value)} /></div>
                        <p className="text-sm text-text-secondary mt-3">{filtered.length} personne{filtered.length !== 1 ? "s" : ""}</p>
                    </div>
                    <div className="max-h-[600px] overflow-y-auto divide-y divide-border-light dark:divide-border-dark">
                        {filtered.length === 0 ? <p className="p-5 text-sm text-text-secondary">Aucune personne trouvée.</p> : filtered.map((person) => (
                            <button type="button" key={person.id} onClick={() => setSelectedId(person.id)} className={"w-full p-4 text-left hover:bg-primary/5 " + (person.id === selectedId ? "bg-primary/10" : "")}>
                                <span className="block font-semibold text-text-main dark:text-white">{person.nom} {person.prenom}</span>
                                <span className="block text-xs text-text-secondary mt-1">{type === "membre" ? person.commission : person.reference_id || "Participant"}</span>
                            </button>
                        ))}
                    </div>
                </Card>
                <Card className="p-4 sm:p-5 min-w-0">
                    <div className="flex flex-wrap justify-between items-center gap-3 mb-4"><h2 className="font-semibold">Prévisualisation</h2><Button className="gap-2" onClick={download} disabled={!selected || generating}><Download className="h-4 w-4" />{generating ? "Génération..." : "Télécharger le PDF"}</Button></div>
                    <div ref={certificateRef} style={{ width: "100%", position: "relative", containerType: "inline-size", background: "#fff" }}>
                        <img src={type === "membre" ? "/images/certificat-membre.png" : "/images/certificat-participant.png"} alt={type === "membre" ? "Certificat de remerciement" : "Certificat de participation"} style={{ display: "block", width: "100%", height: "auto" }} crossOrigin="anonymous" />
                        {type === "membre" && <div aria-hidden="true" style={{ position: "absolute", left: "12%", width: "76%", top: "45%", height: "8.8%", backgroundColor: "#fff" }} />}
                        {fullName && <div style={{ position: "absolute", left: "12%", width: "76%", top: "44.5%", height: "9%", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", color: "#000", fontFamily: "Arial, sans-serif", fontWeight: 900, lineHeight: 1, fontSize: fontSize + "cqw", whiteSpace: "nowrap" }}>{fullName}</div>}
                    </div>
                    {!selected && <p className="mt-3 text-sm text-text-secondary">Choisissez une personne dans la liste pour ajouter son nom.</p>}
                </Card>
            </div>
        </div>
    );
}
