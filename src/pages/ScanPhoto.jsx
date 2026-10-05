import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Camera, CheckCircle, AlertTriangle, Clock } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { uploadPhoto } from "@/lib/storage";
import { Logo } from "@/components/Logo";

// Page publique (sans login) ouverte depuis le QR affiché au secrétariat.
// Le téléphone prend la photo du participant ; l'ordinateur la reçoit en
// temps réel. Jeton à usage unique, 15 minutes.
export function ScanPhoto() {
    const { token } = useParams();
    const [state, setState] = useState("loading"); // loading | ready | sent | invalid | expired | used | error
    const [dossier, setDossier] = useState(null);
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [sending, setSending] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");

    useEffect(() => {
        async function load() {
            try {
                const { data, error } = await supabase
                    .from("photo_sessions")
                    .select("id, status, expires_at, inscription:inscriptions(id, nom, prenom, reference_id)")
                    .eq("token", token)
                    .maybeSingle();
                if (error) throw error;
                if (!data) { setState("invalid"); return; }
                if (data.status === "used") { setState("used"); return; }
                if (new Date(data.expires_at).getTime() < Date.now()) {
                    setState("expired");
                    await supabase.from("photo_sessions").update({ status: "expired" }).eq("id", data.id);
                    return;
                }
                setDossier({ sessionId: data.id, ...data.inscription });
                setState("ready");
            } catch (err) {
                console.error("ScanPhoto:", err);
                setState("error");
            }
        }
        load();
    }, [token]);

    const onFile = (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        setFile(f);
        setPreview(URL.createObjectURL(f));
    };

    const envoyer = async () => {
        if (!file || !dossier) return;
        setSending(true);
        try {
            const url = await uploadPhoto(file, "telephone");
            const { error } = await supabase
                .from("photo_sessions")
                .update({ photo_url: url, status: "used" })
                .eq("id", dossier.sessionId)
                .eq("status", "pending");
            if (error) throw error;
            setState("sent");
        } catch (err) {
            console.error("Envoi photo:", err);
            setErrorMsg(err.message || "Envoi impossible, réessayez.");
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center p-4">
            <Card className="w-full max-w-md">
                <CardContent className="p-6 flex flex-col items-center gap-4 text-center">
                    <Logo />
                    {state === "loading" && <p className="text-text-secondary">Chargement...</p>}

                    {state === "ready" && dossier && (
                        <>
                            <p className="font-bold text-text-main dark:text-white text-lg">
                                Photo de {dossier.nom} {dossier.prenom}
                            </p>
                            <p className="text-sm text-text-secondary font-mono">{dossier.reference_id}</p>
                            {preview ? (
                                <img src={preview} alt="Aperçu" className="w-full rounded-xl border border-border-light dark:border-border-dark" />
                            ) : (
                                <label className="w-full cursor-pointer rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 p-8 flex flex-col items-center gap-2">
                                    <Camera className="h-10 w-10 text-primary" />
                                    <span className="font-semibold text-primary">Prendre la photo</span>
                                    <span className="text-xs text-text-secondary">Utilise l'appareil photo du téléphone</span>
                                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
                                </label>
                            )}
                            {preview && (
                                <div className="flex gap-3 w-full">
                                    <label className="flex-1 cursor-pointer">
                                        <span className="block text-center rounded-lg border border-border-light dark:border-border-dark px-4 py-3 text-sm font-semibold">
                                            Reprendre
                                        </span>
                                        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
                                    </label>
                                    <Button className="flex-1" disabled={sending} onClick={envoyer}>
                                        {sending ? "Envoi..." : "Envoyer"}
                                    </Button>
                                </div>
                            )}
                            {errorMsg && <p className="text-red-500 text-sm">{errorMsg}</p>}
                        </>
                    )}

                    {state === "sent" && (
                        <>
                            <CheckCircle className="h-12 w-12 text-emerald-500" />
                            <p className="font-bold text-text-main dark:text-white">Photo envoyée !</p>
                            <p className="text-sm text-text-secondary">Elle s'affiche sur l'ordinateur du secrétariat. Vous pouvez fermer cette page.</p>
                        </>
                    )}

                    {(state === "invalid" || state === "error") && (
                        <>
                            <AlertTriangle className="h-12 w-12 text-red-500" />
                            <p className="font-bold text-text-main dark:text-white">Lien invalide</p>
                            <p className="text-sm text-text-secondary">Demandez au secrétariat de générer un nouveau QR code.</p>
                        </>
                    )}

                    {state === "expired" && (
                        <>
                            <Clock className="h-12 w-12 text-amber-500" />
                            <p className="font-bold text-text-main dark:text-white">QR expiré (15 min)</p>
                            <p className="text-sm text-text-secondary">Demandez au secrétariat de générer un nouveau QR code.</p>
                        </>
                    )}

                    {state === "used" && (
                        <>
                            <CheckCircle className="h-12 w-12 text-emerald-500" />
                            <p className="font-bold text-text-main dark:text-white">Photo déjà envoyée</p>
                            <p className="text-sm text-text-secondary">Ce QR a déjà servi. Fermez cette page.</p>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
