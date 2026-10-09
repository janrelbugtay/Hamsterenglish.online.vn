import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

async function generateCover() {
    console.log('Starting cover generation with Puppeteer...');
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 800, deviceScaleFactor: 2 });

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@600;700&family=Montserrat:wght@800;900&display=swap');
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
                width: 1200px;
                height: 800px;
                overflow: hidden;
                background: #000;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            canvas {
                width: 1200px;
                height: 800px;
                display: block;
            }
        </style>
    </head>
    <body>
        <canvas id="c" width="2400" height="1600"></canvas>
        <script>
            const canvas = document.getElementById('c');
            const ctx = canvas.getContext('2d');
            const W = 2400;
            const H = 1600;

            // Sky background
            const skyGrad = ctx.createLinearGradient(0, 0, 0, H * 0.55);
            skyGrad.addColorStop(0, '#7bc4e8');
            skyGrad.addColorStop(0.5, '#a4dbf2');
            skyGrad.addColorStop(0.9, '#f5e4cf');
            skyGrad.addColorStop(1, '#ebd0b2');
            ctx.fillStyle = skyGrad;
            ctx.fillRect(0, 0, W, H);

            // Distant soft clouds
            ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
            function drawCloud(cx, cy, r) {
                ctx.beginPath();
                ctx.arc(cx, cy, r, 0, Math.PI * 2);
                ctx.arc(cx + r * 0.8, cy - r * 0.2, r * 0.7, 0, Math.PI * 2);
                ctx.arc(cx - r * 0.8, cy - r * 0.1, r * 0.6, 0, Math.PI * 2);
                ctx.fill();
            }
            drawCloud(400, 200, 120);
            drawCloud(1900, 180, 150);
            drawCloud(1200, 140, 90);

            // Squid game playground wall
            ctx.fillStyle = '#e5c09e';
            ctx.fillRect(0, H * 0.38, W, H * 0.2);
            
            // Wall top pink rail
            ctx.fillStyle = '#f43f5e';
            ctx.fillRect(0, H * 0.375, W, 20);

            // Wall banner on the left (Squid Game sign)
            ctx.fillStyle = '#181e2b';
            ctx.fillRect(150, H * 0.18, 550, 280);
            ctx.strokeStyle = '#334155';
            ctx.lineWidth = 10;
            ctx.strokeRect(150, H * 0.18, 550, 280);

            // Banner symbols: Circle, Triangle, Square in hot pink
            ctx.strokeStyle = '#f43f5e';
            ctx.lineWidth = 18;
            ctx.shadowColor = '#f43f5e';
            ctx.shadowBlur = 25;
            
            // Circle
            ctx.beginPath();
            ctx.arc(260, H * 0.27, 45, 0, Math.PI * 2);
            ctx.stroke();

            // Triangle
            ctx.beginPath();
            ctx.moveTo(420, H * 0.27 - 45);
            ctx.lineTo(465, H * 0.27 + 45);
            ctx.lineTo(375, H * 0.27 + 45);
            ctx.closePath();
            ctx.stroke();

            // Square
            ctx.strokeRect(525, H * 0.27 - 40, 80, 80);
            ctx.shadowBlur = 0;

            // Letters on banner
            ctx.fillStyle = '#94a3b8';
            ctx.font = '900 36px Montserrat, sans-serif';
            ctx.fillText('SQUID GAME', 250, H * 0.35);

            // Giant Doll in distance (Right side)
            const dollX = 1950;
            const dollY = H * 0.38;
            // Doll body (orange dress)
            ctx.fillStyle = '#ea580c';
            ctx.beginPath();
            ctx.moveTo(dollX - 60, dollY + 220);
            ctx.lineTo(dollX + 60, dollY + 220);
            ctx.lineTo(dollX + 40, dollY + 70);
            ctx.lineTo(dollX - 40, dollY + 70);
            ctx.closePath();
            ctx.fill();
            // Doll yellow top
            ctx.fillStyle = '#fbbf24';
            ctx.fillRect(dollX - 35, dollY + 30, 70, 55);
            // Doll head
            ctx.fillStyle = '#fed7aa';
            ctx.beginPath();
            ctx.arc(dollX, dollY, 42, 0, Math.PI * 2);
            ctx.fill();
            // Doll black hair with bangs
            ctx.fillStyle = '#1e1b4b';
            ctx.beginPath();
            ctx.arc(dollX, dollY - 8, 44, Math.PI, Math.PI * 2);
            ctx.fill();
            ctx.fillRect(dollX - 44, dollY - 10, 16, 40);
            ctx.fillRect(dollX + 28, dollY - 10, 16, 40);
            // Pigtails
            ctx.beginPath();
            ctx.arc(dollX - 52, dollY + 8, 14, 0, Math.PI * 2);
            ctx.arc(dollX + 52, dollY + 8, 14, 0, Math.PI * 2);
            ctx.fill();

            // Sand Arena Ground with perspective
            const groundGrad = ctx.createLinearGradient(0, H * 0.5, 0, H);
            groundGrad.addColorStop(0, '#dfba94');
            groundGrad.addColorStop(0.4, '#d8ad83');
            groundGrad.addColorStop(1, '#c8976b');
            ctx.fillStyle = groundGrad;
            ctx.fillRect(0, H * 0.5, W, H * 0.5);

            // Pink / Red arena boundary lines on sand
            ctx.strokeStyle = '#e11d48';
            ctx.lineWidth = 14;
            ctx.beginPath();
            ctx.moveTo(0, H * 0.72);
            ctx.lineTo(W, H * 0.72);
            ctx.stroke();

            ctx.lineWidth = 8;
            ctx.strokeStyle = '#f43f5e';
            ctx.beginPath();
            ctx.moveTo(0, H * 0.58);
            ctx.lineTo(W, H * 0.58);
            ctx.stroke();

            // Soft shadow under characters
            function drawShadow(x, y, rx, ry) {
                ctx.save();
                const sGrad = ctx.createRadialGradient(x, y, 0, x, y, rx);
                sGrad.addColorStop(0, 'rgba(30, 20, 15, 0.45)');
                sGrad.addColorStop(0.7, 'rgba(40, 25, 20, 0.25)');
                sGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
                ctx.fillStyle = sGrad;
                ctx.beginPath();
                ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }

            drawShadow(450, 1180, 220, 60);
            drawShadow(1950, 1180, 220, 60);
            drawShadow(1200, 1380, 360, 90);

            // Helper: Masked Hamster Guard (Left & Right)
            function drawMaskedGuard(gx, gy, scale, symbolType) {
                ctx.save();
                ctx.translate(gx, gy);
                ctx.scale(scale, scale);

                // Boots
                ctx.fillStyle = '#0f172a';
                ctx.beginPath();
                ctx.ellipse(-70, 230, 50, 30, 0, 0, Math.PI * 2);
                ctx.ellipse(70, 230, 50, 30, 0, 0, Math.PI * 2);
                ctx.fill();

                // Chubby Body in Hot Pink Jumpsuit
                const bodyGrad = ctx.createRadialGradient(0, 100, 30, 0, 100, 180);
                bodyGrad.addColorStop(0, '#fb7185');
                bodyGrad.addColorStop(0.6, '#e11d48');
                bodyGrad.addColorStop(1, '#9f1239');
                ctx.fillStyle = bodyGrad;
                ctx.beginPath();
                ctx.ellipse(0, 100, 160, 150, 0, 0, Math.PI * 2);
                ctx.fill();

                // Black tactical belt
                ctx.fillStyle = '#0f172a';
                ctx.fillRect(-140, 130, 280, 40);
                ctx.fillStyle = '#94a3b8';
                ctx.fillRect(-25, 126, 50, 48);
                ctx.fillStyle = '#0f172a';
                ctx.fillRect(-15, 134, 30, 32);

                // Black tactical harness straps
                ctx.fillStyle = '#1e293b';
                ctx.save();
                ctx.rotate(-0.25);
                ctx.fillRect(-120, 20, 35, 140);
                ctx.restore();
                ctx.save();
                ctx.rotate(0.25);
                ctx.fillRect(85, 20, 35, 140);
                ctx.restore();

                // Arms & Hands holding weapon
                ctx.fillStyle = '#e11d48';
                ctx.beginPath();
                ctx.ellipse(-150, 90, 45, 80, -0.3, 0, Math.PI * 2);
                ctx.ellipse(150, 90, 45, 80, 0.3, 0, Math.PI * 2);
                ctx.fill();

                // Black Gloves
                ctx.fillStyle = '#0f172a';
                ctx.beginPath();
                ctx.arc(-110, 140, 36, 0, Math.PI * 2);
                ctx.arc(90, 130, 36, 0, Math.PI * 2);
                ctx.fill();

                // Submachine gun
                ctx.fillStyle = '#1e293b';
                ctx.fillRect(-160, 115, 260, 34);
                ctx.fillRect(-60, 145, 30, 60); // magazine
                ctx.fillStyle = '#0f172a';
                ctx.fillRect(-190, 123, 40, 18); // barrel tip

                // Head (Pink Hood)
                const hoodGrad = ctx.createRadialGradient(0, -60, 40, 0, -60, 160);
                hoodGrad.addColorStop(0, '#f43f5e');
                hoodGrad.addColorStop(0.7, '#e11d48');
                hoodGrad.addColorStop(1, '#881337');
                ctx.fillStyle = hoodGrad;
                ctx.beginPath();
                ctx.arc(0, -60, 150, 0, Math.PI * 2);
                ctx.fill();

                // Hamster Ears on Hood
                function drawEar(ex, ey, flip) {
                    ctx.save();
                    ctx.translate(ex, ey);
                    ctx.rotate(flip ? 0.3 : -0.3);
                    // Outer ear
                    ctx.fillStyle = '#e11d48';
                    ctx.beginPath();
                    ctx.ellipse(0, 0, 48, 56, 0, 0, Math.PI * 2);
                    ctx.fill();
                    // Inner soft pink ear
                    ctx.fillStyle = '#fca5a5';
                    ctx.beginPath();
                    ctx.ellipse(0, 4, 30, 38, 0, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                }
                drawEar(-125, -170, false);
                drawEar(125, -170, true);

                // Black Mesh Mask
                const maskGrad = ctx.createRadialGradient(0, -50, 30, 0, -50, 120);
                maskGrad.addColorStop(0, '#27272a');
                maskGrad.addColorStop(0.7, '#18181b');
                maskGrad.addColorStop(1, '#09090b');
                ctx.fillStyle = maskGrad;
                ctx.beginPath();
                ctx.ellipse(0, -50, 115, 115, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#09090b';
                ctx.lineWidth = 14;
                ctx.stroke();

                // White Mask Symbol
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 14;
                ctx.shadowColor = 'rgba(255,255,255,0.7)';
                ctx.shadowBlur = 15;
                if (symbolType === 'circle') {
                    ctx.beginPath();
                    ctx.arc(0, -55, 42, 0, Math.PI * 2);
                    ctx.stroke();
                } else if (symbolType === 'square') {
                    ctx.strokeRect(-40, -95, 80, 80);
                } else if (symbolType === 'triangle') {
                    ctx.beginPath();
                    ctx.moveTo(0, -98);
                    ctx.lineTo(48, -18);
                    ctx.lineTo(-48, -18);
                    ctx.closePath();
                    ctx.stroke();
                }
                ctx.shadowBlur = 0;
                ctx.restore();
            }

            // Draw Background Guards
            drawMaskedGuard(450, 950, 0.85, 'circle');
            drawMaskedGuard(1950, 950, 0.85, 'square');

            // Draw CENTER LEADER HAMSTER GUARD (Exposed Cute Face!)
            function drawCenterLeaderHamster(gx, gy) {
                ctx.save();
                ctx.translate(gx, gy);

                // Boots
                ctx.fillStyle = '#09090b';
                ctx.beginPath();
                ctx.ellipse(-110, 340, 75, 42, 0, 0, Math.PI * 2);
                ctx.ellipse(110, 340, 75, 42, 0, 0, Math.PI * 2);
                ctx.fill();

                // Chubby Potbelly in Pink Jumpsuit
                const suitGrad = ctx.createRadialGradient(-30, 120, 60, 0, 150, 280);
                suitGrad.addColorStop(0, '#fb7185');
                suitGrad.addColorStop(0.4, '#f43f5e');
                suitGrad.addColorStop(0.8, '#e11d48');
                suitGrad.addColorStop(1, '#881337');
                ctx.fillStyle = suitGrad;
                ctx.beginPath();
                ctx.ellipse(0, 160, 240, 220, 0, 0, Math.PI * 2);
                ctx.fill();

                // Center zipper line
                ctx.strokeStyle = '#4c0519';
                ctx.lineWidth = 7;
                ctx.beginPath();
                ctx.moveTo(0, 20);
                ctx.lineTo(0, 320);
                ctx.stroke();

                // Black Tactical Belt
                ctx.fillStyle = '#0f172a';
                ctx.fillRect(-220, 190, 440, 56);
                // Silver buckle
                ctx.fillStyle = '#94a3b8';
                ctx.fillRect(-35, 185, 70, 66);
                ctx.fillStyle = '#0f172a';
                ctx.fillRect(-20, 197, 40, 42);

                // Black Tactical Shoulder Straps / Harness
                ctx.fillStyle = '#1e293b';
                ctx.save();
                ctx.rotate(-0.2);
                ctx.fillRect(-175, 30, 48, 200);
                ctx.restore();
                ctx.save();
                ctx.rotate(0.2);
                ctx.fillRect(130, 30, 48, 200);
                ctx.restore();

                // Tactical Blaster / Submachine Gun held in front
                ctx.save();
                ctx.translate(0, 140);
                ctx.rotate(-0.08);

                // Gun Body
                const gunGrad = ctx.createLinearGradient(-260, 0, 200, 0);
                gunGrad.addColorStop(0, '#09090b');
                gunGrad.addColorStop(0.5, '#1e293b');
                gunGrad.addColorStop(1, '#0f172a');
                ctx.fillStyle = gunGrad;
                ctx.fillRect(-280, -25, 460, 50); // main receiver
                ctx.fillRect(-120, 25, 55, 100); // curved magazine
                ctx.fillRect(-340, -12, 70, 24); // extended barrel
                ctx.fillStyle = '#475569';
                ctx.fillRect(-240, -32, 280, 10); // top tactical rail

                // Black Gloved Hamster Paws gripping the blaster
                ctx.fillStyle = '#09090b';
                // Left hand supporting barrel
                ctx.beginPath();
                ctx.ellipse(-160, 15, 45, 35, 0.4, 0, Math.PI * 2);
                ctx.fill();
                // Right hand on trigger & grip
                ctx.beginPath();
                ctx.ellipse(90, 10, 48, 38, -0.3, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();

                // Arms in Pink Jumpsuit sleeves
                ctx.fillStyle = '#e11d48';
                ctx.beginPath();
                ctx.ellipse(-230, 130, 65, 110, -0.45, 0, Math.PI * 2);
                ctx.ellipse(230, 130, 65, 110, 0.45, 0, Math.PI * 2);
                ctx.fill();

                // Head - Big Pink Hood
                const hoodGrad = ctx.createRadialGradient(0, -90, 60, 0, -90, 240);
                hoodGrad.addColorStop(0, '#fb7185');
                hoodGrad.addColorStop(0.5, '#f43f5e');
                hoodGrad.addColorStop(0.85, '#e11d48');
                hoodGrad.addColorStop(1, '#881337');
                ctx.fillStyle = hoodGrad;
                ctx.beginPath();
                ctx.arc(0, -90, 230, 0, Math.PI * 2);
                ctx.fill();

                // Hamster Ears sticking out of hood
                function drawHamsterEar(ex, ey, flip) {
                    ctx.save();
                    ctx.translate(ex, ey);
                    ctx.rotate(flip ? 0.35 : -0.35);
                    // Outer hood ear
                    ctx.fillStyle = '#e11d48';
                    ctx.beginPath();
                    ctx.ellipse(0, 0, 75, 90, 0, 0, Math.PI * 2);
                    ctx.fill();
                    // Inner soft pink skin ear
                    const inGrad = ctx.createRadialGradient(0, 5, 10, 0, 5, 60);
                    inGrad.addColorStop(0, '#fecdd3');
                    inGrad.addColorStop(0.7, '#f472b6');
                    inGrad.addColorStop(1, '#e11d48');
                    ctx.fillStyle = inGrad;
                    ctx.beginPath();
                    ctx.ellipse(0, 6, 48, 62, 0, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                }
                drawHamsterEar(-195, -250, false);
                drawHamsterEar(195, -250, true);

                // Black Visor Cap on the forehead of the hood
                ctx.fillStyle = '#18181b';
                ctx.beginPath();
                ctx.roundRect(-150, -260, 300, 75, [20, 20, 8, 8]);
                ctx.fill();
                ctx.fillStyle = '#09090b';
                ctx.fillRect(-160, -200, 320, 22);

                // White Square on the visor
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 12;
                ctx.shadowColor = '#ffffff';
                ctx.shadowBlur = 12;
                ctx.strokeRect(-32, -250, 64, 46);
                ctx.shadowBlur = 0;

                // Cute Hamster Face (Exposed from the hood)
                // Upper forehead golden-tan fur
                const goldFurGrad = ctx.createRadialGradient(0, -90, 30, 0, -90, 160);
                goldFurGrad.addColorStop(0, '#e59b58');
                goldFurGrad.addColorStop(0.7, '#d97706');
                goldFurGrad.addColorStop(1, '#b45309');
                ctx.fillStyle = goldFurGrad;
                ctx.beginPath();
                ctx.arc(0, -80, 160, 0, Math.PI * 2);
                ctx.fill();

                // Lower face & Chubby Fluffy White Cheeks
                const cheekGrad = ctx.createRadialGradient(0, -30, 40, 0, -30, 170);
                cheekGrad.addColorStop(0, '#ffffff');
                cheekGrad.addColorStop(0.8, '#fdfaf5');
                cheekGrad.addColorStop(1, '#fed7aa');
                ctx.fillStyle = cheekGrad;

                // Left chubby cheek
                ctx.beginPath();
                ctx.ellipse(-85, -45, 95, 75, -0.15, 0, Math.PI * 2);
                ctx.fill();

                // Right chubby cheek
                ctx.beginPath();
                ctx.ellipse(85, -45, 95, 75, 0.15, 0, Math.PI * 2);
                ctx.fill();

                // Chin / Muzzle center
                ctx.beginPath();
                ctx.ellipse(0, -35, 90, 65, 0, 0, Math.PI * 2);
                ctx.fill();

                // Soft blush on cheeks
                ctx.fillStyle = 'rgba(251, 113, 133, 0.28)';
                ctx.beginPath();
                ctx.arc(-110, -35, 38, 0, Math.PI * 2);
                ctx.arc(110, -35, 38, 0, Math.PI * 2);
                ctx.fill();

                // Big Glossy Dark Hamster Eyes
                function drawHamsterEye(ex, ey, flip) {
                    ctx.save();
                    ctx.translate(ex, ey);
                    // Dark socket
                    ctx.fillStyle = '#09090b';
                    ctx.beginPath();
                    ctx.arc(0, 0, 32, 0, Math.PI * 2);
                    ctx.fill();

                    // Specular highlights for life
                    ctx.fillStyle = '#ffffff';
                    ctx.beginPath();
                    ctx.arc(-8, -10, 11, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.beginPath();
                    ctx.arc(10, 8, 5, 0, Math.PI * 2);
                    ctx.fill();

                    // Angry / Determined cute eyebrows
                    ctx.strokeStyle = '#78350f';
                    ctx.lineWidth = 10;
                    ctx.lineCap = 'round';
                    ctx.beginPath();
                    if (flip) {
                        ctx.moveTo(35, -36);
                        ctx.lineTo(-24, -26);
                    } else {
                        ctx.moveTo(-35, -36);
                        ctx.lineTo(24, -26);
                    }
                    ctx.stroke();
                    ctx.restore();
                }
                drawHamsterEye(-75, -95, false);
                drawHamsterEye(75, -95, true);

                // Cute Pink Hamster Nose
                const noseGrad = ctx.createLinearGradient(0, -60, 0, -42);
                noseGrad.addColorStop(0, '#fb7185');
                noseGrad.addColorStop(1, '#f43f5e');
                ctx.fillStyle = noseGrad;
                ctx.beginPath();
                ctx.moveTo(0, -40);
                ctx.lineTo(-18, -58);
                ctx.lineTo(18, -58);
                ctx.closePath();
                ctx.fill();

                // Tiny mouth slit
                ctx.strokeStyle = '#9f1239';
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.moveTo(0, -40);
                ctx.lineTo(0, -28);
                ctx.moveTo(-16, -24);
                ctx.quadraticCurveTo(0, -20, 16, -24);
                ctx.stroke();

                // Whiskers!
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
                ctx.lineWidth = 3.5;
                ctx.lineCap = 'round';
                // Left whiskers
                ctx.beginPath();
                ctx.moveTo(-70, -42); ctx.lineTo(-190, -58);
                ctx.moveTo(-70, -34); ctx.lineTo(-200, -32);
                ctx.moveTo(-70, -26); ctx.lineTo(-180, -04);
                // Right whiskers
                ctx.moveTo(70, -42); ctx.lineTo(190, -58);
                ctx.moveTo(70, -34); ctx.lineTo(200, -32);
                ctx.moveTo(70, -26); ctx.lineTo(180, -04);
                ctx.stroke();

                ctx.restore();
            }

            drawCenterLeaderHamster(1200, 940);

            // Foreground: Back of Green Tracksuit Hamster Players watching the guards!
            function drawGreenHamsterBack(gx, gy, scale) {
                ctx.save();
                ctx.translate(gx, gy);
                ctx.scale(scale, scale);

                // Green Tracksuit Body
                const trackGrad = ctx.createRadialGradient(0, 120, 30, 0, 120, 180);
                trackGrad.addColorStop(0, '#059669');
                trackGrad.addColorStop(0.7, '#047857');
                trackGrad.addColorStop(1, '#064e3b');
                ctx.fillStyle = trackGrad;
                ctx.beginPath();
                ctx.ellipse(0, 120, 180, 150, 0, 0, Math.PI * 2);
                ctx.fill();

                // White track stripes on shoulders
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 14;
                ctx.beginPath();
                ctx.arc(-110, 100, 70, -1.2, 0.5);
                ctx.arc(110, 100, 70, 2.6, 4.3);
                ctx.stroke();

                // Fluffy Hamster Head (from behind)
                const furGrad = ctx.createRadialGradient(0, -30, 40, 0, -30, 140);
                furGrad.addColorStop(0, '#d97706');
                furGrad.addColorStop(0.8, '#b45309');
                furGrad.addColorStop(1, '#78350f');
                ctx.fillStyle = furGrad;
                ctx.beginPath();
                ctx.arc(0, -30, 130, 0, Math.PI * 2);
                ctx.fill();

                // Cute round ears
                ctx.fillStyle = '#b45309';
                ctx.beginPath();
                ctx.arc(-100, -110, 42, 0, Math.PI * 2);
                ctx.arc(100, -110, 42, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#fca5a5';
                ctx.beginPath();
                ctx.arc(-100, -108, 26, 0, Math.PI * 2);
                ctx.arc(100, -108, 26, 0, Math.PI * 2);
                ctx.fill();

                ctx.restore();
            }

            drawGreenHamsterBack(260, 1540, 1.15);
            drawGreenHamsterBack(1200, 1600, 1.25);
            drawGreenHamsterBack(2140, 1540, 1.15);

            // Title Overlay & Styling at Top / Center
            ctx.save();
            // Squid Game symbols badge
            ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
            ctx.strokeStyle = '#f43f5e';
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.roundRect(750, 60, 900, 170, 36);
            ctx.fill();
            ctx.stroke();

            // Squid Game Symbols in Badge
            ctx.strokeStyle = '#f43f5e';
            ctx.lineWidth = 8;
            // Circle
            ctx.beginPath();
            ctx.arc(830, 145, 28, 0, Math.PI * 2);
            ctx.stroke();
            // Triangle
            ctx.beginPath();
            ctx.moveTo(920, 118);
            ctx.lineTo(948, 172);
            ctx.lineTo(892, 172);
            ctx.closePath();
            ctx.stroke();
            // Square
            ctx.strokeRect(985, 118, 54, 54);

            // Title text
            ctx.fillStyle = '#ffffff';
            ctx.font = '900 58px Fredoka, sans-serif';
            ctx.fillText('SQUID GAME', 1070, 135);

            ctx.fillStyle = '#34d399';
            ctx.font = '700 32px Fredoka, sans-serif';
            ctx.letterSpacing = '6px';
            ctx.fillText('HAMSTER EDITION • NAME PICKER', 1075, 185);

            ctx.restore();
        </script>
    </body>
    </html>
    `;

    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    // Let fonts load
    await new Promise(r => setTimeout(r, 1000));

    const outputPath = path.resolve(process.cwd(), 'public/images/hamster-squidgame-cover.png');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });

    await page.screenshot({
        path: outputPath,
        type: 'png',
        clip: { x: 0, y: 0, width: 1200, height: 800 }
    });

    console.log('Cover generated successfully at:', outputPath);
    await browser.close();
}

generateCover().catch(console.error);
