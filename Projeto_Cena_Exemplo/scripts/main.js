import * as THREE from "three"
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

// Criar cena do threeJS
let cena = new THREE.Scene()
window.cena = cena
let mixer;
let DiscRotation;
let ArmAction;
let CoverAction;
const clock = new THREE.Clock();

// Criar Renderer
const threeCanvas = document.getElementById('three-canvas');

// Crie o renderer com antialias e pixel ratio do dispositivo para bordas mais nítidas
let renderer = new THREE.WebGLRenderer({canvas: threeCanvas, antialias: true})
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
renderer.setSize(threeCanvas.clientWidth, threeCanvas.clientHeight);
renderer.setClearColor(0xffffff); // Cor de Fundo (Branco neste caso concreto)

// Ativar renderização de mapa de sombras
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap

// Criar e preparar câmara
let camara = new THREE.PerspectiveCamera(60, threeCanvas.clientWidth / threeCanvas.clientHeight, 0.01, 1000)
let controls = new OrbitControls(camara, renderer.domElement)

//Posicão Padrão da Camara
camara.position.set(0.739, 0.356, -0.038)
camara.rotation.set(
    THREE.MathUtils.degToRad(-96.60),
    THREE.MathUtils.degToRad(72.89),
    THREE.MathUtils.degToRad(96.90)
)

// Usar a origem como alvo inicial dos controlos e atualizar os controlos para que a visualização corresponda
controls.target.set(0, 0, 0)
controls.update()

//Adicionar luz ambiente
const ambientLight = new THREE.AmbientLight(0xffffff, 3);
cena.add(ambientLight);

// Mantenha o renderer e a câmara responsivos ao tamanho da janela
function onWindowResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Redimensiona o estilo do canvas e o buffer de desenho do renderer
    threeCanvas.style.width = width + 'px';
    threeCanvas.style.height = height + 'px';
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    camara.aspect = width / height;
    camara.updateProjectionMatrix();
}

// Adicionar listener de redimensionamento
window.addEventListener('resize', onWindowResize, { passive: true });

// chame uma vez para definir o tamanho correto
onWindowResize();

// Carregar modelo, ajustar luzes, e preparar cena exemplo
new GLTFLoader().load(
    //Caminho do Modelo
    'models/RecordPlayer.glb',
    function (gltf) {
        // Informação: 1 Unidade = 0.1m = 1 dm = 10 cm
        cena.add(gltf.scene)

        console.log("=== RELATÓRIO DO MODELO ===");
        console.log("Animações encontradas no ficheiro:", gltf.animations);

        gltf.animations.forEach((clip, index) => {
        console.log(`Animação #${index}: "${clip.name}"`);
    });

        // Ativar sombras em todas as malhas do modelo carregado para que projetem e recebam sombras
        gltf.scene.traverse((obj) => {
            if (obj.isMesh) {
                obj.castShadow = true
                obj.receiveShadow = true
                // Garantir que o material seja atualizado se necessário
                if (Array.isArray(obj.material)) {
                    obj.material.forEach(m => { 
                        if (m) {
                            // Corrigir transparência para materiais que devem ser translúcidos
                            if (m.opacity < 1 || m.alphaMode === 'BLEND' || m.transmission > 0) {
                                m.transparent = true;
                                m.depthWrite = false;
                            }
                            m.needsUpdate = true;
                        }
                    })
                } else if (obj.material) {
                    // Corrigir transparência para materiais que devem ser translúcidos
                    if (obj.material.opacity < 1 || obj.material.alphaMode === 'BLEND' || obj.material.transmission > 0) {
                        obj.material.transparent = true;
                        obj.material.depthWrite = false;
                    }
                    obj.material.needsUpdate = true
                }
            }
        })

        mixer = new THREE.AnimationMixer(gltf.scene);

        const clips = gltf.animations;

        const discClip = THREE.AnimationClip.findByName(clips, 'DiscRotation');
        const armClip = THREE.AnimationClip.findByName(clips, 'ArmAction');
        const coverClip = THREE.AnimationClip.findByName(clips, 'CoverAction');

        if (discClip) {
            DiscRotation = mixer.clipAction(discClip);
            DiscRotation.loop = THREE.LoopRepeat;
            DiscRotation.play();
            console.log("✅ Animação do Disco carregada com sucesso.");
        } else {
        console.error("❌ ERRO: Não encontrei 'DiscAction'. Vê os nomes na lista acima!");
    }
        
        if (armClip) {
            ArmAction = mixer.clipAction(armClip);
            ArmAction.loop = THREE.LoopOnce;
            ArmAction.clampWhenFinished = true;
            console.log("✅ Animação do Braço carregada com sucesso.");
        } else {
        // TENTATIVA DE SALVAÇÃO: Se não encontrar 'ArmAction', tenta apanhar a segunda animação da lista
        if (clips.length > 1) {
            console.warn("⚠️ Aviso: Não encontrei 'ArmAction', vou tentar usar a segunda animação da lista.");
            ArmAction = mixer.clipAction(clips[1]); // Assume que a segunda é a do braço
            ArmAction.loop = THREE.LoopOnce;
            ArmAction.clampWhenFinished = true;
        } else {
            console.error("❌ ERRO CRÍTICO: Não encontrei a animação do braço nem pelo nome, nem por posição.");
        }
    }

        if (coverClip) {
            CoverAction = mixer.clipAction(coverClip);
            CoverAction.loop = THREE.LoopOnce;
            CoverAction.clampWhenFinished = true;
            console.log("✅ Animação da Cover carregada com sucesso.");
        } else {
            console.error("❌ ERRO CRÍTICO: Não encontrei a animação da Cover nem pelo nome, nem por posição.");
        }

        

        // Calcular o centro da caixa delimitadora do modelo e recentralizar os controlos/câmara
        try {
            const bbox = new THREE.Box3().setFromObject(gltf.scene)
            const modelCenter = new THREE.Vector3()
            bbox.getCenter(modelCenter)

            // Mover controls.target para o centro do modelo para que a órbita seja em torno do objeto
            controls.target.copy(modelCenter)

            // Manter o deslocamento da câmara que foi configurado anteriormente, mas torná-lo relativo ao centro do modelo
            const currentCamPos = camara.position.clone()
            const offsetFromOrigin = currentCamPos.clone()

            // Nova posição absoluta da câmara = modelCenter + offsetFromOrigin
            const newCamPos = modelCenter.clone().add(offsetFromOrigin)
            camara.position.copy(newCamPos)
            camara.lookAt(modelCenter)
            controls.update()

            console.log('Camera repositioned to:', camara.position)
        } catch (err) {
            console.warn('Could not compute model center or reposition camera:', err)
        }
    }
)

// Renderizar/Animar
{
    let delta = 0;
    let relogio = new THREE.Clock();
    let latencia_minima = 1 / 60; // para 60 frames por segundo 
    animar()
    function animar() {
        if (mixer) mixer.update(clock.getDelta());
        requestAnimationFrame(animar);
        delta += relogio.getDelta();

        if (delta < latencia_minima) return;

        // Atualize os helpers de luz, se existirem
        cena.traverse((child) => {
            if (child instanceof THREE.PointLightHelper || child instanceof THREE.SpotLightHelper || child instanceof THREE.DirectionalLightHelper) {
                child.update();
            }
        });

        renderer.render(cena, camara)

        delta = delta % latencia_minima;
    }
}

const discButtonStart = document.getElementById('disc-start-btn');

if (discButtonStart) {
            discButtonStart.addEventListener('click', () => {
                
                if (DiscRotation) {

                    if (DiscRotation.isRunning()) {
                        DiscRotation.stop();
                    }

                    DiscRotation.reset();

                    DiscRotation.timeScale = 1;

                    DiscRotation.play();

                    console.log("A tocar a animação do braço!");

                } else {
                    console.warn("Atenção: O modelo ou a animção ainda não carregam!");
                }
            })
        }

const discButtonStop = document.getElementById('disc-stop-btn');

if (discButtonStop) {
            discButtonStop.addEventListener('click', () => {
                
                if (DiscRotation) {

                    if (DiscRotation.isRunning()) {
                        DiscRotation.stop();
                    }

                    DiscRotation.reset();

                    DiscRotation.timeScale = 1;

                    console.log("A tocar a animação do braço!");

                } else {
                    console.warn("Atenção: O modelo ou a animção ainda não carregam!");
                }
            })
        }

const armButtonStart = document.getElementById('arm-start-btn');

if (armButtonStart) {
            armButtonStart.addEventListener('click', () => {
                
                if (ArmAction) {

                    if (ArmAction.isRunning()) {
                        ArmAction.stop();
                    }

                    ArmAction.reset();

                    ArmAction.timeScale = 1;

                    ArmAction.play();

                    console.log("A tocar a animação do braço!");

                } else {
                    console.warn("Atenção: O modelo ou a animção ainda não carregam!");
                }
            })
        }

const armButtonStop = document.getElementById('arm-stop-btn');

if (armButtonStop) {
            armButtonStop.addEventListener('click', () => {
                
                if (ArmAction) {

                    if (ArmAction.time === 0) {
                        ArmAction.time = ArmAction.getClip().duration;
                    }

                    ArmAction.paused = false;
                    ArmAction.timeScale = -1;
                    ArmAction.play();
                    ArmAction.setLoop(THREE.LoopOnce);
                    ArmAction.clampWhenFinished = true;
                    ArmAction.play();

                    console.log("A tocar a animação do braço!");

                } else {
                    console.warn("Atenção: O modelo ou a animção ainda não carregam!");
                }
            })
        }

const coverButtonClose = document.getElementById('cover-close-btn');

if (coverButtonClose) {
            coverButtonClose.addEventListener('click', () => {
                
                if (CoverAction) {

                    if (CoverAction.isRunning()) {
                        CoverAction.stop();
                    }

                    CoverAction.reset();

                    CoverAction.timeScale = 1;

                    CoverAction.play();

                    console.log("A tocar a animação da Cover!");

                } else {
                    console.warn("Atenção: O modelo ou a animção ainda não carregam!");
                }
            })
        }

const coverButtonOpen = document.getElementById('cover-open-btn');

if (coverButtonOpen) {
            coverButtonOpen.addEventListener('click', () => {
                
                if (CoverAction) {

                    if (CoverAction.isRunning()) {
                        CoverAction.stop();
                    }

                    CoverAction.reset();

                    CoverAction.timeScale = 1;

                    CoverAction.play();

                    console.log("A tocar a animação da Cover!");

                } else {
                    console.warn("Atenção: O modelo ou a animção ainda não carregam!");
                }
            })
        }
