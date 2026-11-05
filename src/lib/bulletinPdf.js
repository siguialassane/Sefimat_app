// Coordonnées du modèle fourni, rapportées à son aperçu de 1005 × 1300 pixels.
const WIDTH = 1005;
const HEIGHT = 1300;

async function loadImage(url) {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.src = url;
    await image.decode();
    return image;
}

function cropPhoto(image, width, height) {
    const canvas = document.createElement("canvas");
    canvas.width = width * 3;
    canvas.height = height * 3;
    const context = canvas.getContext("2d");
    const scale = Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
    const drawWidth = image.naturalWidth * scale;
    const drawHeight = image.naturalHeight * scale;
    context.drawImage(image, (canvas.width - drawWidth) / 2, (canvas.height - drawHeight) * 0.08, drawWidth, drawHeight);
    return canvas.toDataURL("image/jpeg", 0.94);
}

export async function createBulletinPdf(note, rank, appreciation) {
    const { default: jsPDF } = await import("jspdf");
    const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
    const sx = pdf.internal.pageSize.getWidth() / WIDTH;
    const sy = pdf.internal.pageSize.getHeight() / HEIGHT;
    const background = await loadImage("/images/bulletin-modele.png");
    const backgroundCanvas = document.createElement("canvas");
    backgroundCanvas.width = background.naturalWidth;
    backgroundCanvas.height = background.naturalHeight;
    backgroundCanvas.getContext("2d").drawImage(background, 0, 0);
    pdf.addImage(backgroundCanvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight());

    const cover = (x, y, width, height, color = [255, 255, 255]) => {
        pdf.setFillColor(...color);
        pdf.rect(x * sx, y * sy, width * sx, height * sy, "F");
    };
    const text = (value, x, y, size, maxWidth, options = {}) => {
        pdf.setFont("helvetica", options.bold ? "bold" : "normal");
        pdf.setTextColor(...(options.color || [0, 0, 0]));
        let fontSize = size * sx;
        pdf.setFontSize(fontSize);
        const valueText = String(value ?? "—");
        while (fontSize > 4 && pdf.getTextWidth(valueText) > maxWidth * sx) {
            fontSize -= 0.5;
            pdf.setFontSize(fontSize);
        }
        pdf.text(valueText, x * sx, y * sy, { align: options.align || "left" });
    };

    const inscription = note.inscription || {};
    const niveau = { niveau_1: "NIVEAU 1", niveau_2: "NIVEAU 2", niveau_superieur: "NIVEAU SUPÉRIEUR" }[note.classe?.niveau] || note.classe?.nom || "—";
    const identity = [
        [205, 298, 445, 20, inscription.reference_id || "—", 205, 314],
        [254, 328, 395, 20, (inscription.nom || "") + " " + (inscription.prenom || ""), 254, 344],
        [300, 358, 350, 20, niveau, 300, 374],
        [265, 388, 390, 24, inscription.numero_parent || "—", 265, 404],
    ];
    identity.forEach(([x, y, w, h, value, tx, ty]) => {
        cover(x, y, w, h);
        text(value, tx, ty, 16, w - 5, { bold: true });
    });

    let photoError = false;
    if (inscription.photo_url) {
        try {
            const photo = await loadImage(inscription.photo_url);
            const cropped = cropPhoto(photo, 210, 128);
            pdf.addImage(cropped, "JPEG", 704 * sx, 292 * sy, 210 * sx, 128 * sy);
        } catch {
            photoError = true;
        }
    }

    const values = [note.note_entree, note.note_cahiers, note.note_conduite, note.note_sortie];
    const score = (value) => value === null || value === undefined || value === "" ? "—" : String(Number(value));
    const total = values.every((value) => value !== null && value !== undefined && value !== "")
        ? values.reduce((sum, value) => sum + Number(value), 0) : null;
    const mean = note.moyenne == null ? "—" : Number(note.moyenne).toFixed(2);
    const rows = [
        { y: 520, baseline: 541, color: [244, 246, 244], value: score(values[0]) },
        { y: 580, baseline: 600, color: [255, 255, 255], value: score(values[1]) },
        { y: 639, baseline: 660, color: [244, 246, 244], value: score(values[2]) },
        { y: 698, baseline: 719, color: [255, 255, 255], value: score(values[3]) },
        { y: 756, baseline: 777, color: [232, 245, 233], value: score(total) },
    ];
    rows.forEach((row, index) => {
        cover(372, row.y, 55, 25, row.color);
        text(row.value, 394, row.baseline, 16, 50, { align: "center", bold: index === 4, color: index === 4 ? [28, 101, 46] : [0, 0, 0] });
    });
    cover(723, 580, 200, 25);
    text("Moyenne : " + mean + " / 20", 726, 600, 15, 195);
    cover(723, 639, 200, 25, [244, 246, 244]);
    text("Rang : " + (rank || "—"), 726, 660, 15, 195);
    cover(723, 756, 200, 25, [232, 245, 233]);
    text("Mention : " + (appreciation || "—"), 726, 777, 15, 195, { bold: true, color: [28, 101, 46] });
    return { pdf, photoError };
}
