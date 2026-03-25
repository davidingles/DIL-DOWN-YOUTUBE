const BACKEND_URL = '';

// Elements
const youtubeUrlInput = document.getElementById('youtubeUrl');
const getInfoBtn = document.getElementById('getInfoBtn');
const btnText = getInfoBtn.querySelector('.btn-text');
const btnLoader = getInfoBtn.querySelector('.btn-loader');
const videoCard = document.getElementById('videoCard');
const videoInfo = document.getElementById('videoInfo');
const downloadMp3Btn = document.getElementById('downloadMp3Btn');
const downloadVideoBtn = document.getElementById('downloadVideoBtn');
const progressCard = document.getElementById('progressCard');
const progressOutput = document.getElementById('progressOutput');
const errorMessage = document.getElementById('errorMessage');

let currentUrl = '';

// Helper to format duration
function formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [h, m, s]
        .map(v => v < 10 ? "0" + v : v)
        .filter((v, i) => v !== "00" || i > 0)
        .join(":");
}

// Show Error
function showError(msg) {
    errorMessage.textContent = msg;
    errorMessage.classList.remove('hidden');
    setTimeout(() => {
        errorMessage.classList.add('hidden');
    }, 5000);
}

// Get Video Info
getInfoBtn.addEventListener('click', async () => {
    const url = youtubeUrlInput.value.trim();
    if (!url) return showError('Por favor, ingresa un link de YouTube.');

    // UI State
    btnText.classList.add('hidden');
    btnLoader.classList.remove('hidden');
    getInfoBtn.disabled = true;
    videoCard.classList.add('hidden');
    progressCard.classList.add('hidden');

    try {
        const response = await fetch(`${BACKEND_URL}/api/video-info?url=${encodeURIComponent(url)}`);
        const data = await response.json();

        if (response.ok) {
            currentUrl = url;
            videoInfo.innerHTML = `
                <div class="thumbnail-container">
                    <img src="${data.thumbnail}" alt="Thumbnail">
                </div>
                <div class="details">
                    <h2>${data.title}</h2>
                    <p><strong>Canal:</strong> ${data.uploader}</p>
                    <p><strong>Duración:</strong> ${formatDuration(data.duration)}</p>
                </div>
            `;
            videoCard.classList.remove('hidden');
        } else {
            showError(data.error || 'Error al obtener información del video.');
        }
    } catch (err) {
        showError('No se pudo conectar con el servidor.');
    } finally {
        btnText.classList.remove('hidden');
        btnLoader.classList.add('hidden');
        getInfoBtn.disabled = false;
    }
});

// Start Download
async function startDownload(format) {
    if (!currentUrl) return;

    progressCard.classList.remove('hidden');
    progressOutput.textContent = 'Iniciando descarga...\n';
    
    downloadMp3Btn.disabled = true;
    downloadVideoBtn.disabled = true;

    try {
        const response = await fetch(`${BACKEND_URL}/api/download`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: currentUrl, format })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Fallo en la descarga');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value);
            progressOutput.textContent += chunk;
            progressOutput.scrollTop = progressOutput.scrollHeight;
        }

    } catch (err) {
        progressOutput.textContent += `\nERROR: ${err.message}`;
        showError(err.message);
    } finally {
        downloadMp3Btn.disabled = false;
        downloadVideoBtn.disabled = false;
    }
}

downloadMp3Btn.addEventListener('click', () => startDownload('mp3'));
downloadVideoBtn.addEventListener('click', () => startDownload('video'));

// Enter key support
youtubeUrlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        getInfoBtn.click();
    }
});
