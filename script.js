const scoreMap = { "Very Excellent": 5, Excellent: 4, Good: 3, Average: 2, "No Data Support": 1 };
let genes = {};
let latestResults = [];

const geneSelection = document.getElementById("geneSelection");
const parentInputs = document.getElementById("parentInputs");
const warningBox = document.getElementById("warningBox");

const standardizeGenotype = (g) => g.length <= 2 ? g.split("").sort().join("") : g;

async function loadGenes() {
  genes = await (await fetch("genes.json")).json();
  renderGeneSelection();
  renderInputs();
  renderExplanations();
  setupShareLinks();
}

function renderGeneSelection() {
  geneSelection.innerHTML = "";
  Object.keys(genes).forEach((gene, idx) => {
    geneSelection.insertAdjacentHTML("beforeend", `<label class="gene-item"><input type="checkbox" class="gene-cb" value="${gene}" ${idx < 3 ? "checked" : ""}> ${gene}</label>`);
  });
  geneSelection.addEventListener("change", renderInputs);
}

function renderInputs() {
  const selected = getSelectedGenes();
  parentInputs.innerHTML = selected.map((gene) => {
    const options = genes[gene].genotypeOptions.map((g) => `<option value="${g}">${g}</option>`).join("");
    return `<div class="input-item"><h4>${gene}</h4>
      <label>Father<select id="f-${gene}">${options}</select></label>
      <label>Mother<select id="m-${gene}">${options}</select></label></div>`;
  }).join("");
}

function getSelectedGenes() {
  return [...document.querySelectorAll(".gene-cb:checked")].map((el) => el.value);
}

function generateGametes(genotype) {
  if (genotype.length === 2) return genotype[0] === genotype[1] ? [genotype[0]] : [genotype[0], genotype[1]];
  if (genotype.length === 4) return [genotype.slice(0, 2), genotype.slice(2, 4)];
  return [genotype];
}

function punnettSquare(parent1, parent2) {
  const gam1 = generateGametes(parent1), gam2 = generateGametes(parent2);
  const out = [];
  gam1.forEach((a) => gam2.forEach((b) => out.push(standardizeGenotype(a + b))));
  return out;
}

function calculateProbability(offspring) {
  const counts = offspring.reduce((acc, g) => ((acc[g] = (acc[g] || 0) + 1), acc), {});
  return Object.entries(counts).map(([genotype, count]) => ({ genotype, probability: count / offspring.length }));
}

function combineMultiGeneResults(perGeneResults) {
  let combos = [{ genotypeMap: {}, probability: 1, ratings: [], score: 0 }];
  perGeneResults.forEach(({ gene, results }) => {
    const next = [];
    combos.forEach((combo) => {
      results.forEach((r) => {
        const rating = genes[gene].performanceRating[r.genotype] || "No Data Support";
        next.push({
          genotypeMap: { ...combo.genotypeMap, [gene]: r.genotype },
          probability: combo.probability * r.probability,
          ratings: [...combo.ratings, `${gene}:${rating}`],
          score: combo.score + (scoreMap[rating] || 1)
        });
      });
    });
    combos = next;
  });
  return combos;
}

function rankGenotypes(combos) {
  return combos.sort((a, b) => b.score - a.score || b.probability - a.probability);
}

function calculate() {
  const selected = getSelectedGenes();
  warningBox.textContent = "";
  if (selected.length < 1 || selected.length > 8) {
    warningBox.textContent = "Select between 1 and 8 genes.";
    return;
  }
  const perGene = selected.map((gene) => {
    const father = document.getElementById(`f-${gene}`).value;
    const mother = document.getElementById(`m-${gene}`).value;
    return { gene, results: calculateProbability(punnettSquare(father, mother)) };
  });

  latestResults = rankGenotypes(combineMultiGeneResults(perGene)).slice(0, 50);
  renderResults(selected);
}

function renderResults(selected) {
  const tbody = document.getElementById("resultsTableBody");
  tbody.innerHTML = latestResults.map((r) => {
    const genotypeText = selected.map((g) => `${g}:${r.genotypeMap[g]}`).join(" | ");
    return `<tr><td>${genotypeText}</td><td>${(r.probability * 100).toFixed(2)}</td><td>${r.ratings.join(", ")}</td><td>${r.score}</td></tr>`;
  }).join("");

  const best = latestResults[0];
  const probability = (best.probability * 100).toFixed(2);
  document.getElementById("bestResult").innerHTML = `<h3>Best Genetic Potential</h3>
  <p><strong>Genotype:</strong> ${selected.map((g) => `${g}:${best.genotypeMap[g]}`).join(" | ")}</p>
  <p><strong>Score:</strong> ${best.score} &nbsp; <strong>Probability:</strong> ${probability}%</p>
  <p>Breeding advantage: ${adviceFromResult(best)}.</p>`;

  renderWarnings(selected);
  renderRecommendation(best);
  drawProbabilityChart();
  drawRadar(selected, best);
}

function renderWarnings(selected) {
  const warnings = [];
  if (latestResults[0].probability < 0.1) warnings.push("High uncertainty: best genotype probability is below 10%.");
  if (latestResults.some((r) => r.ratings.some((x) => x.includes("No Data Support")))) warnings.push("Unsupported genotype detected in at least one possible offspring profile.");
  if (new Set(selected.map((g) => document.getElementById(`f-${g}`).value + document.getElementById(`m-${g}`).value)).size < selected.length / 2) warnings.push("Low diversity: many parental pairings are similar across selected genes.");
  warningBox.textContent = warnings.join(" ");
}

function adviceFromResult(best) {
  const text = best.ratings.join(" ");
  if (text.includes("LDHA:Excellent")) return "High endurance breeding potential";
  if (text.includes("CRY1:Excellent") || text.includes("DRD4:Very Excellent")) return "Elite navigation ability";
  if (text.includes("MSTN:Excellent")) return "Strong sprint muscle performance";
  if (text.includes("GSR:Excellent")) return "Weather resistant racing pigeons";
  return "Balanced racing traits";
}

function renderRecommendation(best) {
  document.getElementById("recommendationBox").textContent = `Breeding Advice: ${adviceFromResult(best)}. Maintain performance tracking and cross-reference DNA predictions with race outcomes.`;
}

function drawProbabilityChart() {
  const c = document.getElementById("probabilityChart");
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, c.width, c.height);
  const top = latestResults.slice(0, 8);
  top.forEach((r, i) => {
    const h = r.probability * 170;
    const x = 20 + i * 70;
    ctx.fillStyle = "#2f76c5";
    ctx.fillRect(x, 190 - h, 40, h);
    ctx.fillStyle = "#1d2a3a";
    ctx.font = "11px Arial";
    ctx.fillText(`${(r.probability * 100).toFixed(1)}%`, x - 2, 205);
  });
}

function drawRadar(selected, best) {
  const c = document.getElementById("radarChart");
  const ctx = c.getContext("2d");
  const cx = c.width / 2, cy = c.height / 2, radius = 80;
  ctx.clearRect(0, 0, c.width, c.height);
  const vals = selected.map((gene) => scoreMap[genes[gene].performanceRating[best.genotypeMap[gene]] || "No Data Support"] || 1);
  for (let level = 1; level <= 5; level++) {
    ctx.beginPath();
    selected.forEach((_, i) => {
      const a = (Math.PI * 2 * i) / selected.length - Math.PI / 2;
      const r = (radius * level) / 5;
      const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.closePath(); ctx.strokeStyle = "#d0d8e5"; ctx.stroke();
  }
  ctx.beginPath();
  vals.forEach((v, i) => {
    const a = (Math.PI * 2 * i) / selected.length - Math.PI / 2;
    const r = radius * (v / 5);
    const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    ctx.fillStyle = "#1f5ea8";
    ctx.fillText(selected[i], cx + (radius + 10) * Math.cos(a), cy + (radius + 10) * Math.sin(a));
  });
  ctx.closePath(); ctx.fillStyle = "rgba(31,94,168,0.3)"; ctx.fill(); ctx.strokeStyle = "#1f5ea8"; ctx.stroke();
}

function renderExplanations() {
  const panel = document.getElementById("explanationPanel");
  panel.innerHTML = Object.entries(genes).map(([name, data]) => `<div class="input-item"><h4>${name}</h4><p>${data.description}</p></div>`).join("");
}

function setupActions() {
  const calcBtn = document.getElementById("calculateBtn");
  calcBtn.addEventListener("click", () => {
    calcBtn.classList.add("loading");
    setTimeout(() => { calculate(); calcBtn.classList.remove("loading"); }, 350);
  });
  calcBtn.addEventListener("click", (e) => {
    const circle = document.createElement("span");
    const d = Math.max(calcBtn.clientWidth, calcBtn.clientHeight);
    circle.style.width = circle.style.height = `${d}px`;
    circle.style.left = `${e.clientX - calcBtn.offsetLeft - d / 2}px`;
    circle.style.top = `${e.clientY - calcBtn.offsetTop - d / 2}px`;
    calcBtn.appendChild(circle);
    setTimeout(() => circle.remove(), 600);
  });

  document.getElementById("resetBtn").addEventListener("click", () => location.reload());
  document.getElementById("copyBtn").addEventListener("click", async () => {
    if (!latestResults.length) return;
    const text = latestResults.slice(0, 10).map((r) => JSON.stringify(r)).join("\n");
    await navigator.clipboard.writeText(text);
    alert("Results copied.");
  });
  document.getElementById("csvBtn").addEventListener("click", downloadCSV);
  document.getElementById("pdfBtn").addEventListener("click", downloadPDFReport);
}

function downloadCSV() {
  if (!latestResults.length) return;
  const selected = getSelectedGenes();
  const rows = ["Offspring Genotype,Probability,Performance Rating,Genetic Score"];
  latestResults.forEach((r) => rows.push(`"${selected.map((g) => `${g}:${r.genotypeMap[g]}`).join(" | ")}",${(r.probability * 100).toFixed(2)},"${r.ratings.join("; ")}",${r.score}`));
  const blob = new Blob([rows.join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = "pigeon-genetic-results.csv"; a.click();
}

function downloadPDFReport() {
  if (!latestResults.length) return;
  const w = window.open("", "_blank");
  w.document.write(`<html><head><title>Genetic Report</title></head><body><h1>Racing Pigeon Genetic Report</h1>${document.getElementById("bestResult").innerHTML}<table border="1" cellpadding="6"><tr><th>Genotype</th><th>Probability</th><th>Score</th></tr>${latestResults.slice(0, 20).map((r) => `<tr><td>${Object.entries(r.genotypeMap).map(([k, v]) => `${k}:${v}`).join(" | ")}</td><td>${(r.probability * 100).toFixed(2)}%</td><td>${r.score}</td></tr>`).join("")}</table><p>Use browser Print > Save as PDF.</p></body></html>`);
  w.document.close();
  w.focus();
  w.print();
}

function setupShareLinks() {
  const url = encodeURIComponent(location.href);
  const title = encodeURIComponent("Racing Pigeon Genetic Calculator");
  document.getElementById("shareX").href = `https://twitter.com/intent/tweet?url=${url}&text=${title}`;
  document.getElementById("shareFb").href = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
  document.getElementById("shareLi").href = `https://www.linkedin.com/sharing/share-offsite/?url=${url}`;
  document.getElementById("shareWa").href = `https://api.whatsapp.com/send?text=${title}%20${url}`;
}

if ("serviceWorker" in navigator) navigator.serviceWorker.register("service-worker.js");
setupActions();
loadGenes();
