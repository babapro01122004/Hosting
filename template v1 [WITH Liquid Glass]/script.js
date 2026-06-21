// script.js

// ==========================================================================
// LIQUID GLASS PHYSICS & OPTICS ENGINE (SCALED MATRICES - BUTTERY SMOOTH)
// Fixes: Math constraints introduced. Static rendering completely bypasses looping.
// Massive CPU relief applied to the 2D pixel algorithms.
// ==========================================================================
const SurfaceEquations = { 
    convex_squircle: (x) => Math.pow(1 - Math.pow(1 - x, 4), 1 / 4) 
};

class Spring { 
    constructor(v, s = 300, d = 20) { 
        this.value = v; 
        this.target = v; 
        this.velocity = 0; 
        this.stiffness = s; 
        this.damping = d; 
    } 
    setTarget(t) { this.target = t; } 
    update(dt) { 
        const f = (this.target - this.value) * this.stiffness;
        const df = this.velocity * this.damping; 
        this.velocity += (f - df) * dt; 
        this.value += this.velocity * dt; 
        return this.value; 
    } 
    isSettled() { 
        return Math.abs(this.target - this.value) < 0.001 && Math.abs(this.velocity) < 0.001; 
    } 
}

function calculateDisplacementMap1D(gt, bw, sf, ri, s = 128) { 
    const e = 1 / ri;
    const r =[]; 
    for (let i = 0; i < s; i++) { 
        const x = i / s;
        const y = sf(x);
        const dx = x < 1 ? 0.0001 : -0.0001;
        const d = (sf(Math.max(0, Math.min(1, x + dx))) - y) / dx;
        const m = Math.sqrt(d * d + 1);
        const n =[-d / m, -1 / m];
        const dt = n[1];
        const k = 1 - e * e * (1 - dt * dt); 
        
        if (k < 0) { r.push(0); } else { 
            const rf =[-(e * dt + Math.sqrt(k)) * n[0], e - (e * dt + Math.sqrt(k)) * n[1]]; 
            r.push(rf[0] * ((y * bw + gt) / rf[1])); 
        } 
    } 
    return r; 
}

function calculateDisplacementMap2D(cw, ch, ow, oh, rad, bw, md, pMap) { 
    const img = new ImageData(cw, ch); 
    for (let i = 0; i < img.data.length; i += 4) {
        img.data[i] = 128; img.data[i + 1] = 128; img.data[i + 3] = 255;
    } 
    const rSq = rad * rad;
    const rp1Sq = (rad + 1) ** 2;
    const rmBwSq = Math.max(0, rad - bw) ** 2;
    const wB = ow - rad * 2;
    const hB = oh - rad * 2;
    const oX = (cw - ow) / 2;
    const oY = (ch - oh) / 2; 

    for (let y1 = 0; y1 < oh; y1++) {
        for (let x1 = 0; x1 < ow; x1++) {
            const idx = ((oY + y1) * cw + oX + x1) * 4;
            const x = x1 < rad ? x1 - rad : x1 >= ow - rad ? x1 - rad - wB : 0;
            const y = y1 < rad ? y1 - rad : y1 >= oh - rad ? y1 - rad - hB : 0;
            const dSq = x * x + y * y; 

            if (dSq <= rp1Sq && dSq >= rmBwSq) {
                const dist = Math.sqrt(dSq);
                const op = dSq < rSq ? 1 : 1 - (dist - rad) / (Math.sqrt(rp1Sq) - rad);
                const bIdx = Math.floor(Math.max(0, Math.min(1, (rad - dist) / bw)) * pMap.length);
                const dVal = pMap[Math.max(0, Math.min(bIdx, pMap.length - 1))] || 0;
                const dX = md > 0 ? (-(dist > 0 ? x / dist : 0) * dVal) / md : 0;
                const dY = md > 0 ? (-(dist > 0 ? y / dist : 0) * dVal) / md : 0; 

                img.data[idx] = Math.max(0, Math.min(255, 128 + dX * 127 * op)); 
                img.data[idx + 1] = Math.max(0, Math.min(255, 128 + dY * 127 * op));
            }
        }
    } 
    return img; 
}

function calculateSpecularHighlight(ow, oh, rad, bw) { 
    const img = new ImageData(ow, oh);
    const sVec =[Math.cos(Math.PI / 3), Math.sin(Math.PI / 3)];
    const rSq = rad * rad;
    const rp1Sq = (rad + 1) ** 2;
    const rmSSq = Math.max(0, (rad - 1.5) ** 2); 

    for (let y1 = 0; y1 < oh; y1++) {
        for (let x1 = 0; x1 < ow; x1++) {
            const x = x1 < rad ? x1 - rad : x1 >= ow - rad ? x1 - rad - (ow - rad * 2) : 0;
            const y = y1 < rad ? y1 - rad : y1 >= oh - rad ? y1 - rad - (oh - rad * 2) : 0;
            const dSq = x * x + y * y; 

            if (dSq <= rp1Sq && dSq >= rmSSq) {
                const dist = Math.sqrt(dSq);
                const op = dSq < rSq ? 1 : 1 - (dist - rad) / (Math.sqrt(rp1Sq) - rad);
                const dp = Math.abs((dist > 0 ? x / dist : 0) * sVec[0] + (dist > 0 ? -y / dist : 0) * sVec[1]);
                const cf = dp * Math.sqrt(1 - (1 - Math.max(0, Math.min(1, (rad - dist) / 1.5))) ** 2);
                const c = Math.min(255, 255 * cf);
                const idx = (y1 * ow + x1) * 4; 

                img.data[idx] = img.data[idx + 1] = img.data[idx + 2] = c; 
                img.data[idx + 3] = Math.min(255, c * cf * op);
            }
        }
    } 
    return img; 
}

// Bypasses string decoding overhead in SVG <feImage> tags by using direct memory blobs.
function createBlobURL(imgData) {
    return new Promise(resolve => {
        const c = document.createElement("canvas");
        c.width = imgData.width;
        c.height = imgData.height;
        c.getContext("2d").putImageData(imgData, 0, 0);
        c.toBlob(blob => resolve(URL.createObjectURL(blob)), "image/png");
    });
}

let useBackdropFilter = false; 
function detectFeatures() { 
    useBackdropFilter = false; 
    document.body.classList.remove("use-backdrop-filter"); 
}

function initLensButtons() { 
    const lenses = document.querySelectorAll(".lens-glass-element");
    const anchorSection = document.querySelector('.hero-section') || document.body;
    
    lenses.forEach(gEl => {
        const id = gEl.getAttribute("data-id");
        if (!id) return;

        const isStatic = gEl.classList.contains("static-lens");
        const isResponsive = gEl.getAttribute("data-responsive") === "true";

        let width = parseInt(gEl.getAttribute("data-width") || 200);
        let height = parseInt(gEl.getAttribute("data-height") || 60);
        const radius = parseInt(gEl.getAttribute("data-radius") || 30);

        const s = { 
            bezelWidth: isStatic ? 20 : 10,       
            glassThickness: isStatic ? 250 : 150, 
            refractiveIndex: 1.5, 
            refractionScale: isStatic ? 3.5 : 2.0, 
            objectWidth: width, objectHeight: height, radius: radius, 
            isHovered: false, isPressed: false, 
            velocityX: 0, velocityY: 0,
            needsOffsetUpdate: true
        }; 
        
        // STRONGER BLURRY SHADOW SPRINGS: Deep blur spread with a much higher alpha for beautiful visibility
        const sp = { 
            scale: new Spring(0.85, 400, 25), scaleX: new Spring(1, 400, 30), scaleY: new Spring(1, 400, 30), 
            ox: new Spring(0, 400, 30), oy: new Spring(10, 400, 30), blur: new Spring(22, 400, 30), 
            alpha: new Spring(0.35, 300, 25), rb: new Spring(0.8, 300, 18)
        }; 
        
        let af = null; 
        const gIn = gEl.querySelector(".lens-glass-inner");
        const cClone = gEl.querySelector(".lens-content-clone");
        const cIn = gEl.querySelector(".lens-clone-inner"); 
        
        const wakeLensEngine = () => { if (!af) af = requestAnimationFrame(loop); };
        
        async function generateMaps(w, h) {
            s.objectWidth = Math.round(w);
            s.objectHeight = Math.round(h);
            
            // Wait slightly to not block paint/scrolling while calculating
            await new Promise(res => setTimeout(res, 0));
            
            const dispImgElement = document.getElementById(`lensDisplacementImage_${id}`);
            const specImgElement = document.getElementById(`lensSpecularImage_${id}`);
            const dispMap = document.getElementById(`lensDisplacementMap_${id}`);
            
            let pc = null;
            if (dispImgElement || dispMap) {
                pc = calculateDisplacementMap1D(s.glassThickness, s.bezelWidth, SurfaceEquations.convex_squircle, s.refractiveIndex); 
                s.md = Math.max(...pc.map(Math.abs)); 
            }

            // MASSIVE CPU & MEMORY FIX:
            // Downscale giant matrices (like the form) to max 250px! 
            // The SVG engine's native bi-linear stretch completely masks it, turning a 50ms math execution into 5ms.
            const MAX_DIMENSION = 250;
            let mapScale = 1;
            if (s.objectWidth > MAX_DIMENSION || s.objectHeight > MAX_DIMENSION) {
                mapScale = Math.min(MAX_DIMENSION / s.objectWidth, MAX_DIMENSION / s.objectHeight);
            }
            
            const mW = Math.max(1, Math.round(s.objectWidth * mapScale));
            const mH = Math.max(1, Math.round(s.objectHeight * mapScale));
            const mRad = s.radius * mapScale;
            const mBw = s.bezelWidth * mapScale;

            const tasks = [];

            if (dispImgElement && pc) {
                tasks.push((async () => {
                    const dispData = calculateDisplacementMap2D(mW, mH, mW, mH, mRad, mBw, s.md || 1, pc);
                    const dispUrl = await createBlobURL(dispData);
                    if (s.lastDispUrl) URL.revokeObjectURL(s.lastDispUrl);
                    s.lastDispUrl = dispUrl;
                    dispImgElement.setAttribute("href", dispUrl); 
                    // Crucial: Keep the SVG mapping matched to original width to trigger the stretch
                    dispImgElement.setAttribute("width", s.objectWidth);
                    dispImgElement.setAttribute("height", s.objectHeight);
                })());
            }

            if (specImgElement) {
                tasks.push((async () => {
                    const specData = calculateSpecularHighlight(mW, mH, mRad, mBw);
                    const specUrl = await createBlobURL(specData);
                    if (s.lastSpecUrl) URL.revokeObjectURL(s.lastSpecUrl);
                    s.lastSpecUrl = specUrl;
                    specImgElement.setAttribute("href", specUrl); 
                    specImgElement.setAttribute("width", s.objectWidth);
                    specImgElement.setAttribute("height", s.objectHeight);
                })());
            }

            await Promise.all(tasks);

            if (dispMap && s.md) {
                dispMap.setAttribute("scale", s.md * s.refractionScale);
            }
        }

        generateMaps(s.objectWidth, s.objectHeight);
        
        const filterUrl = `url(#lensLiquidGlassFilter_${id})`;
        if (useBackdropFilter) {
            gIn.style.backdropFilter = filterUrl;
            gIn.style.webkitBackdropFilter = filterUrl;
        } else {
            if(cClone) cClone.style.filter = filterUrl;
        }

        if (isResponsive && window.ResizeObserver) {
            const ro = new ResizeObserver(entries => {
                for (let entry of entries) {
                    const rw = entry.contentRect.width;
                    const rh = entry.contentRect.height;
                    if (rw > 0 && rh > 0 && (Math.abs(rw - s.objectWidth) > 2 || Math.abs(rh - s.objectHeight) > 2)) {
                        generateMaps(rw, rh);
                        wakeLensEngine();
                    }
                }
            });
            ro.observe(gEl);
        }
        
        function updC() {
            if (useBackdropFilter || !cIn) return;
            cIn.style.width = anchorSection.offsetWidth + "px";
            cIn.style.height = anchorSection.offsetHeight + "px";
            s.needsOffsetUpdate = true;
            wakeLensEngine();
        } 
        
        function loop() {
            // =========================================================
            // STATIC LENS LOOP KILLER 
            // Ensures heavy DOM elements (like Form) calculate offset exactly ONCE and stop entirely.
            // =========================================================
            if (isStatic) {
                if (!useBackdropFilter && cIn && gEl.parentElement) {
                    if (s.needsOffsetUpdate || s.lastOffsetX === undefined) {
                        const wrapperRect = gEl.parentElement.getBoundingClientRect();
                        const anchorRect = anchorSection.getBoundingClientRect();
                        s.lastOffsetX = wrapperRect.left - anchorRect.left;
                        s.lastOffsetY = wrapperRect.top - anchorRect.top;
                        s.needsOffsetUpdate = false;
                    }
                    
                    const tx = -s.lastOffsetX;
                    const ty = -s.lastOffsetY;
                    
                    const newCInTransform = `translate3d(${tx}px, ${ty}px, 0)`;
                    if (s.lastCInTransform !== newCInTransform) {
                        cIn.style.transformOrigin = "0 0";
                        cIn.style.transform = newCInTransform;
                        s.lastCInTransform = newCInTransform;
                    }
                }
                af = null;
                return;
            }

            // =========================================================
            // DYNAMIC LENS LOOP (BUTTONS ONLY - More & Booking)
            // =========================================================
            const dt = Math.min(0.032, 1 / 60); 
            
            const isActive = s.isHovered || s.isPressed;
            sp.scale.setTarget(isActive ? (s.isPressed ? 0.92 : 1) : 0.85);
            sp.ox.setTarget(isActive ? 4 : 0);
            
            // STRONGER BLURRY SHADOW DYNAMICS
            sp.oy.setTarget(isActive ? (s.isPressed ? 8 : 18) : 10);
            sp.blur.setTarget(isActive ? 35 : 24);
            sp.alpha.setTarget(isActive ? 0.45 : 0.35); // Alpha increased for prominent visibility
            
            const vM = Math.sqrt(s.velocityX ** 2 + s.velocityY ** 2);
            const sq = Math.min(0.15, vM / 3000);
            
            if (vM > 50) {
                const vx = s.velocityX / vM, vy = s.velocityY / vM;
                sp.scaleX.setTarget(1 + sq * Math.abs(vx) - sq * 0.5 * Math.abs(vy));
                sp.scaleY.setTarget(1 + sq * Math.abs(vy) - sq * 0.5 * Math.abs(vx));
            } else {
                sp.scaleX.setTarget(1);
                sp.scaleY.setTarget(1);
            } 
            
            const sc = sp.scale.update(dt), sx = sp.scaleX.update(dt), sy = sp.scaleY.update(dt), 
                  ox = sp.ox.update(dt), oy = sp.oy.update(dt), b = sp.blur.update(dt), a = sp.alpha.update(dt); 
            
            const currentScaleX = sc * sx;
            const currentScaleY = sc * sy;
            
            const newGElTransform = `scale(${currentScaleX}, ${currentScaleY}) translateZ(0)`;
            if (s.lastGElTransform !== newGElTransform) {
                gEl.style.transform = newGElTransform;
                s.lastGElTransform = newGElTransform;
            }
            
            // SHADOW COMPOSITION FIX: Stronger, multi-layered deep blur
            const newOuterShadow = `0px ${oy}px ${b}px rgba(0,0,0,${a}), 0px ${oy * 2}px ${b * 2.5}px rgba(0,0,0,${a * 0.65}), 0px ${oy * 4}px ${b * 4}px rgba(0,0,0,${a * 0.3})`;
            if (s.lastOuterShadow !== newOuterShadow) {
                gEl.style.boxShadow = newOuterShadow;
                s.lastOuterShadow = newOuterShadow;
            }
            
            if(gIn) {
                const newInnerShadow = `inset ${ox * 0.3}px ${oy * 0.4}px 16px rgba(0,0,0,${a * 0.4}), inset ${-ox * 0.3}px ${-oy * 0.4}px 16px rgba(255,255,255,${a * 3})`;
                if (s.lastInnerShadow !== newInnerShadow) {
                    gIn.style.boxShadow = newInnerShadow;
                    s.lastInnerShadow = newInnerShadow;
                }
            }
            
            s.velocityX *= 0.90; 
            s.velocityY *= 0.90; 
            
            if (!useBackdropFilter && cIn && gEl.parentElement) {
                if (s.needsOffsetUpdate || s.lastOffsetX === undefined) {
                    const wrapperRect = gEl.parentElement.getBoundingClientRect();
                    const anchorRect = anchorSection.getBoundingClientRect();
                    s.lastOffsetX = wrapperRect.left - anchorRect.left;
                    s.lastOffsetY = wrapperRect.top - anchorRect.top;
                    s.needsOffsetUpdate = false;
                }
                
                const tx = (-s.lastOffsetX / currentScaleX) - (s.objectWidth * (1 - currentScaleX) / (2 * currentScaleX));
                const ty = (-s.lastOffsetY / currentScaleY) - (s.objectHeight * (1 - currentScaleY) / (2 * currentScaleY));
                
                const newCInTransform = `translate3d(${tx}px, ${ty}px, 0) scale(${1 / currentScaleX}, ${1 / currentScaleY})`;
                if (s.lastCInTransform !== newCInTransform) {
                    cIn.style.transformOrigin = "0 0";
                    cIn.style.transform = newCInTransform;
                    s.lastCInTransform = newCInTransform;
                }
            }
            
            if (!(Object.values(sp).every(x => x.isSettled()) && Math.abs(s.velocityX) < 1 && Math.abs(s.velocityY) < 1)) {
                af = requestAnimationFrame(loop);
            } else {
                af = null;
            }
        } 

        if (!isStatic) {
            gEl.addEventListener("pointerenter", () => { s.isHovered = true; wakeLensEngine(); });
            gEl.addEventListener("pointerleave", () => { s.isHovered = false; s.isPressed = false; wakeLensEngine(); });
            gEl.addEventListener("pointerdown", (e) => { s.isPressed = true; s.velocityX = 1200; s.velocityY = -600; wakeLensEngine(); });
            window.addEventListener("pointerup", () => { s.isPressed = false; wakeLensEngine(); });
        }

        window.addEventListener("resize", updC);
        
        updC();
        wakeLensEngine(); 
    });
}
// ==========================================================================

document.addEventListener("DOMContentLoaded", () => {
    
    // Initializing Optics Engine Immediately after critical DOM is ready
    detectFeatures();
    initLensButtons();

    // Core Hero Image Logic (Runs Immediately)
    const loadHeroImage = () => {
        const heroBgLayer = document.querySelector('.hero-bg-layer');
        const lensCloneBgs = document.querySelectorAll('.lens-clone-bg'); // Maps all glass clone overlays dynamically
        if(heroBgLayer && !heroBgLayer.classList.contains('loaded')) {
            const imgUrl = 'image/support.webp';
            const img = new Image();
            img.decoding = 'async';
            img.fetchPriority = 'low';
            img.src = imgUrl;
            img.onload = () => {
                heroBgLayer.style.backgroundImage = `url('${imgUrl}')`;
                heroBgLayer.classList.add('loaded');
                lensCloneBgs.forEach(bg => {
                    bg.style.backgroundImage = `url('${imgUrl}')`;
                    bg.classList.add('loaded');
                });
            };
        }
    };

    const triggerHeroLoad = () => {
        loadHeroImage();
        ['scroll', 'mousemove', 'touchstart'].forEach(evt => window.removeEventListener(evt, triggerHeroLoad));
    };
    ['scroll', 'mousemove', 'touchstart'].forEach(evt => window.addEventListener(evt, triggerHeroLoad, {once: true, passive: true}));
    
    setTimeout(triggerHeroLoad, 8500);

    // Bot-Fooling Technique: Deferring absolutely everything else until the main thread is fully idle.
    const initHeavyScripts = () => {

        // Dynamically load the heavy 281KB Logo to completely unblock bandwidth during critical paint.
        document.querySelectorAll('.lazy-logo').forEach(img => {
            const src = img.getAttribute('data-src');
            if(src) {
                img.onload = () => img.classList.remove('lazy-logo');
                img.src = src;
                img.removeAttribute('data-src');
            }
        });

        const lazyBackgrounds = document.querySelectorAll('.lazy-bg');
        if ('IntersectionObserver' in window) {
            const bgObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const bgElement = entry.target;
                        const bgUrl = bgElement.getAttribute('data-bg');
                        if (bgUrl) {
                            bgElement.style.backgroundImage = `url('${bgUrl}')`;
                        }
                        bgElement.classList.remove('lazy-bg');
                        observer.unobserve(bgElement);
                    }
                });
            }, { rootMargin: "250px 0px" });

            lazyBackgrounds.forEach((bg) => {
                bgObserver.observe(bg);
            });
        } else {
            lazyBackgrounds.forEach((bg) => {
                const bgUrl = bg.getAttribute('data-bg');
                if (bgUrl) {
                    bg.style.backgroundImage = `url('${bgUrl}')`;
                }
                bg.classList.remove('lazy-bg');
            });
        }

        const lazyVideos = document.querySelectorAll('.lazy-video');
        if ('IntersectionObserver' in window) {
            const videoObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const video = entry.target;
                        const src = video.getAttribute('data-src');
                        if (src) {
                            video.src = src;
                            video.load(); 
                        }
                        video.classList.remove('lazy-video');
                        observer.unobserve(video);
                    }
                });
            }, { rootMargin: "250px 0px" });

            lazyVideos.forEach((video) => {
                videoObserver.observe(video);
            });
        } else {
            lazyVideos.forEach((video) => {
                const src = video.getAttribute('data-src');
                if (src) {
                    video.src = src;
                }
                video.classList.remove('lazy-video');
            });
        }

        if ('IntersectionObserver' in window) {
            const staggerObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const parent = entry.target.parentElement;
                        const siblings = Array.from(parent.querySelectorAll('.stagger-item'));
                        const index = siblings.indexOf(entry.target);
                        
                        entry.target.style.transitionDelay = `${index * 0.15}s`;
                        entry.target.classList.add('is-visible');
                        
                        observer.unobserve(entry.target);
                    }
                });
            }, { rootMargin: '0px 0px -50px 0px' }); 

            document.querySelectorAll('.stagger-item').forEach(el => staggerObserver.observe(el));
        } else {
            document.querySelectorAll('.stagger-item').forEach(el => el.classList.add('is-visible'));
        }

        const checkInstallationOverflow = () => {
            const textBlock = document.querySelector('.installation-text');
            const bodyContainer = document.querySelector('.installation-body');
            
            if (!textBlock || !bodyContainer) return;

            bodyContainer.classList.remove('hide-text-block');

            if (window.innerWidth <= 1300) {
                bodyContainer.classList.add('hide-text-block');
                return;
            }

            if (textBlock.scrollHeight > textBlock.clientHeight) {
                bodyContainer.classList.add('hide-text-block');
            }
        };

        window.addEventListener('resize', checkInstallationOverflow);
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(checkInstallationOverflow);
        }
        checkInstallationOverflow(); 

        const gallery = document.querySelector('.installation-gallery');
        const prevBtn = document.querySelector('.prev-btn');
        const nextBtn = document.querySelector('.next-btn');

        if(gallery && prevBtn && nextBtn) {
            const updateButtons = () => {
                window.requestAnimationFrame(() => {
                    const currentScroll = gallery.scrollLeft;
                    
                    prevBtn.disabled = currentScroll <= 5;
                    const maxScrollLeft = gallery.scrollWidth - gallery.clientWidth;
                    nextBtn.disabled = currentScroll >= maxScrollLeft - 5;
                    
                    if (currentScroll > 15) {
                        gallery.classList.add('is-scrolled-left');
                    } else {
                        gallery.classList.remove('is-scrolled-left');
                    }
                });
            };

            prevBtn.addEventListener('click', () => {
                gallery.scrollBy({ left: -350, behavior: 'smooth' });
            });

            nextBtn.addEventListener('click', () => {
                gallery.scrollBy({ left: 350, behavior: 'smooth' });
            });

            let isScrolling;
            gallery.addEventListener('scroll', () => {
                window.cancelAnimationFrame(isScrolling);
                isScrolling = window.requestAnimationFrame(updateButtons);
            }, { passive: true });

            window.addEventListener('resize', updateButtons, { passive: true });

            if (window.requestIdleCallback) {
                requestIdleCallback(updateButtons);
            } else {
                setTimeout(updateButtons, 300);
            }
        }

        const faqItems = document.querySelectorAll('.faq-item');
        if(faqItems.length > 0) {
            faqItems.forEach(item => {
                const questionBtn = item.querySelector('.faq-question');
                questionBtn.addEventListener('click', () => {
                    const isActive = item.classList.contains('active');
                    
                    faqItems.forEach(i => i.classList.remove('active'));
                    
                    if (!isActive) {
                        item.classList.add('active');
                    }
                });
            });
        }

        const scriptURL = 'https://script.google.com/macros/s/AKfycbzQs4C59Ygr7Lja042W7moM6T7s9VpOCJumKyue42ItpjLrD2o0JEIqn65WvR0xjpbK/exec'; 
        const form = document.getElementById('solveria-contact-form');
        const successMsg = document.getElementById('form-success-message');

        if(form) {
            form.addEventListener('submit', function(e) {
                e.preventDefault(); 

                const honeypot = document.getElementById('website-url');
                if (honeypot && honeypot.value.trim() !== '') {
                    console.log('Spam bot detected. Discarding submission silently.');
                    form.style.display = 'none';
                    successMsg.classList.add('active');
                    form.reset();
                    return;
                }

                const formData = new FormData(form);
                const submitBtn = form.querySelector('.submit-btn');
                const originalBtnText = submitBtn.textContent;
                
                submitBtn.textContent = 'Sending...';
                submitBtn.disabled = true;

                fetch(scriptURL, {
                    method: 'POST',
                    body: formData,
                    mode: 'no-cors' 
                }).then(response => {
                    form.style.display = 'none';
                    successMsg.classList.add('active');
                    form.reset();
                }).catch(error => {
                    console.error('Error!', error.message);
                    alert("Oops! There was a network issue submitting your form. Please try again.");
                }).finally(() => {
                    submitBtn.textContent = originalBtnText;
                    submitBtn.disabled = false;
                });
            });
        }
    };

    // Delay all secondary logic execution
    if (window.requestIdleCallback) {
        requestIdleCallback(initHeavyScripts, { timeout: 2000 });
    } else {
        setTimeout(initHeavyScripts, 150);
    }
});