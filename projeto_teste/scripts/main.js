import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// Criar cena do threeJS
let cena = new THREE.Scene();
window.cena = cena;
//cena.background = new THREE.Color(0xdddddd); ------------------------------NÃO SEI SE DEIXO OU APAGO-----------------------------------------------

let mixer;
let DiscRotation;
let ArmAction;
let CoverAction;
const clock = new THREE.Clock();

// Criar Renderer
const threeCanvas = document.getElementById("three-canvas");

// Crie o renderer com antialias e pixel ratio do dispositivo para bordas mais nítidas
let renderer = new THREE.WebGLRenderer({
  canvas: threeCanvas,
  antialias: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(threeCanvas.clientWidth, threeCanvas.clientHeight);
renderer.setClearColor(0xdddddd); // cor anterior mais clara: 0xffffff

// Ativar renderização de mapa de sombras
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Criar e preparar câmara
let camara = new THREE.PerspectiveCamera(
  60,
  threeCanvas.clientWidth / threeCanvas.clientHeight,
  0.01,
  1000
);
let controls = new OrbitControls(camara, renderer.domElement);

//Posicão Padrão da Camara
camara.position.set(0.739, 0.356, -0.038);
camara.rotation.set(
  THREE.MathUtils.degToRad(-96.6),
  THREE.MathUtils.degToRad(72.89),
  THREE.MathUtils.degToRad(96.9)
);

// Usar a origem como alvo inicial dos controlos e atualizar os controlos para que a visualização corresponda
controls.target.set(0, 0, 0);
controls.update();

//Adicionar luz ambiente
const ambientLight = new THREE.AmbientLight(0xffffff, 3);
cena.add(ambientLight);

// Mantenha o renderer e a câmara responsivos ao tamanho da janela
function onWindowResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;

  // Redimensiona o estilo do canvas e o buffer de desenho do renderer
  threeCanvas.style.width = width + "px";
  threeCanvas.style.height = height + "px";
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  camara.aspect = width / height;
  camara.updateProjectionMatrix();
}

// Adicionar listener de redimensionamento
window.addEventListener("resize", onWindowResize, { passive: true });

// chame uma vez para definir o tamanho correto
onWindowResize();

let vidroLampadaMesh = null;
let luzAmbienteCandeeiro = null;

// Carregar modelo, ajustar luzes, e preparar cena exemplo
new GLTFLoader().load(
  //Caminho do Modelo
  "models/RecordPlayer.glb",
  function (gltf) {
    // Informação: 1 Unidade = 0.1m = 1 dm = 10 cm
    cena.add(gltf.scene);

    console.log("=== DEBUG MODELO ===");
    console.log("Animações no ficheiro:", gltf.animations);

    gltf.animations.forEach((clip, index) => {
      console.log(`Animação #${index}: "${clip.name}"`);
    });

    // Ativar sombras em todas as malhas do modelo carregado para que projetem e recebam sombras
    gltf.scene.traverse((obj) => {
      if (obj.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
        // Garantir que o material seja atualizado se necessário
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => {
            if (m) {
              // Corrigir transparência para materiais que devem ser translúcidos
              if (
                m.opacity < 1 ||
                m.alphaMode === "BLEND" ||
                m.transmission > 0
              ) {
                m.transparent = true;
                m.depthWrite = false;
              }
              m.needsUpdate = true;
            }
          });
        } else if (obj.material) {
          // Corrigir transparência para materiais que devem ser translúcidos
          if (
            obj.material.opacity < 1 ||
            obj.material.alphaMode === "BLEND" ||
            obj.material.transmission > 0
          ) {
            obj.material.transparent = true;
            obj.material.depthWrite = false;
          }
          obj.material.needsUpdate = true;
        }

        if (obj.name === 'VidroLampada') {
                    console.log("💡 Encontrei a lâmpada!");
                    vidroLampadaMesh = obj;

                    // Cria a luz real e cola-a à esfera
                    luzAmbienteCandeeiro = new THREE.PointLight(0xffaa00, 0, 3); // Intensidade 0 (Apagada)
                    luzAmbienteCandeeiro.position.set(0, 0, 0);
                    obj.add(luzAmbienteCandeeiro);
                }

      }
    });

    mixer = new THREE.AnimationMixer(gltf.scene);

    const clips = gltf.animations;

    const discClip = THREE.AnimationClip.findByName(clips, "DiscRotation");
    const armClip = THREE.AnimationClip.findByName(clips, "ArmAction");
    const coverClip = THREE.AnimationClip.findByName(clips, "CoverAction");

    if (discClip) {
      DiscRotation = mixer.clipAction(discClip);
      DiscRotation.loop = THREE.LoopRepeat;
      DiscRotation.play();
      console.log("Animação do disco carregada");
    } else {
      console.error("ERRO no Disco!!!");
    }

    if (armClip) {
      ArmAction = mixer.clipAction(armClip);
      ArmAction.loop = THREE.LoopOnce;
      ArmAction.clampWhenFinished = true;
      console.log("Animação do braço carregada");
    } else {
      console.error("ERRO no Braço!!!");
    }

    if (coverClip) {
      CoverAction = mixer.clipAction(coverClip);
      CoverAction.loop = THREE.LoopOnce;
      CoverAction.clampWhenFinished = true;
      console.log("Animação da Cover carregada");
    } else {
      console.error("ERRO na Cover!!!");
    }

    // Calcular o centro da caixa delimitadora do modelo e recentralizar os controlos/câmara
    try {
      const bbox = new THREE.Box3().setFromObject(gltf.scene);
      const modelCenter = new THREE.Vector3();
      bbox.getCenter(modelCenter);

      // Mover controls.target para o centro do modelo para que a órbita seja em torno do objeto
      controls.target.copy(modelCenter);

      // Manter o deslocamento da câmara que foi configurado anteriormente, mas torná-lo relativo ao centro do modelo
      const currentCamPos = camara.position.clone();
      const offsetFromOrigin = currentCamPos.clone();

      // Nova posição absoluta da câmara = modelCenter + offsetFromOrigin
      const newCamPos = modelCenter.clone().add(offsetFromOrigin);
      camara.position.copy(newCamPos);
      camara.lookAt(modelCenter);
      controls.update();

      console.log("Camera repositioned to:", camara.position);
    } catch (err) {
      console.warn("Could not compute model center or reposition camera:", err);
    }
  }
);

// Renderizar/Animar
{
  let delta = 0;
  let relogio = new THREE.Clock();
  let latencia_minima = 1 / 60; // para 60 frames por segundo
  animar();
  function animar() {
    if (mixer) mixer.update(clock.getDelta());
    requestAnimationFrame(animar);
    delta += relogio.getDelta();

    if (delta < latencia_minima) return;

    // Atualize os helpers de luz, se existirem
    cena.traverse((child) => {
      if (
        child instanceof THREE.PointLightHelper ||
        child instanceof THREE.SpotLightHelper ||
        child instanceof THREE.DirectionalLightHelper
      ) {
        child.update();
      }
    });

    renderer.render(cena, camara);

    delta = delta % latencia_minima;
  }
}


// Botão para girar o Disco
const discButtonStart = document.getElementById("disc-start-btn");

if (discButtonStart) {
  discButtonStart.addEventListener("click", () => {
    if (DiscRotation) {
      if (DiscRotation.isRunning()) {
        DiscRotation.stop();
      }

      DiscRotation.reset();
      DiscRotation.timeScale = 1;
      DiscRotation.play();
      console.log("A animação girar disco!");
    } else {
      console.warn("A animção girar disco não carregou!");
    }
  });
}


// Botão para parar o Disco
const discButtonStop = document.getElementById("disc-stop-btn");

if (discButtonStop) {
  discButtonStop.addEventListener("click", () => {
    if (DiscRotation) {
      if (DiscRotation.isRunning()) {
        DiscRotation.stop();
      }

      DiscRotation.reset();
      DiscRotation.timeScale = 1;
      console.log("A animação parar disco!");
    } else {
      console.warn("A animção parar disco não carregou!");
    }
  });
}


// Botão para baixar o Braço
const armButtonStart = document.getElementById("arm-start-btn");

if (armButtonStart) {
  armButtonStart.addEventListener("click", () => {
    if (ArmAction) {
      if (ArmAction.isRunning()) {
        ArmAction.stop();
      }

      ArmAction.reset();
      ArmAction.timeScale = 1;
      ArmAction.play();
      console.log("A animação baixar braço!");
    } else {
      console.warn("A animção baixar braço não carregou!");
    }
  });
}


// Botão para levantar o Braço
const armButtonStop = document.getElementById("arm-stop-btn");

if (armButtonStop) {
  armButtonStop.addEventListener("click", () => {
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
      console.log("A animação subir braço!");
    } else {
      console.warn("A animção subir braço não carregou!");
    }
  });
}


// Botão para baixar a Cover
const coverButtonClose = document.getElementById("cover-close-btn");

if (coverButtonClose) {
  coverButtonClose.addEventListener("click", () => {
    if (CoverAction) {
      if (CoverAction.isRunning()) {
        CoverAction.stop();
      }

      CoverAction.reset();
      CoverAction.timeScale = 1;
      CoverAction.play();
      console.log("A animação baixar cover!");
    } else {
      console.warn("A animção baixar cover não carregou!");
    }
  });
}


// Botão para levantar a Cover
const coverButtonOpen = document.getElementById("cover-open-btn");

if (coverButtonOpen) {
  coverButtonOpen.addEventListener("click", () => {
    if (CoverAction) {
      if (CoverAction.time === 0) {
        CoverAction.time = CoverAction.getClip().duration;
      }

      CoverAction.paused = false;
      CoverAction.timeScale = -1;
      CoverAction.play();
      CoverAction.setLoop(THREE.LoopOnce);
      CoverAction.clampWhenFinished = true;
      CoverAction.play();
      console.log("A animação subir cover!");
    } else {
      console.warn("A animção subir cover não carregou!");
    }
  });
}


// Função para mudar o material
function mudarMaterial(tipo) {
    const cenaAlvo = (typeof cena !== 'undefined') ? cena : scene;
    
    console.log(`Material atual: ${tipo}`);

    cenaAlvo.traverse((child) => {
        if (child.isMesh) {
            if (child.name === 'Body' || child.name === 'Base' || child.name === 'Wood' || child.name === 'Chassis') { 

                if (!child.userData.originalMap) {
                    child.userData.originalMap = child.material.map;
                }
                
                if (tipo === 'original') {

                    if (child.userData.originalMap) {
                        child.material.map = child.userData.originalMap; 
                    }
                    // Original
                    child.material.color.setHex(0xffffff);
                    child.material.roughness = 0.5;
                    child.material.metalness = 0.0;
                    child.material.needsUpdate = true;
                } 
                else if (tipo === 'black') {
                    // Preto
                    child.material.map = null;
                    child.material.color.setHex(0x444444);
                    child.material.roughness = 0.8;
                    child.material.metalness = 0.3;
                    child.material.needsUpdate = true;
                } 
                else if (tipo === 'grey') {
                    // Cinza
                    child.material.map = null;
                    child.material.color.setHex(0xaaaaaa);
                    child.material.roughness = 0.4;
                    child.material.metalness = 0.0;
                    child.material.needsUpdate = true;
                }
            }
        }
    });
}


// Botão Material Original
const materialButtonOriginal = document.getElementById("change-material-btn");
if (materialButtonOriginal) {
    materialButtonOriginal.addEventListener('click', () => mudarMaterial('original'));
}

// Botão Material Preto
const materialButtonBlack = document.getElementById('material-black-btn');
if (materialButtonBlack) {
    materialButtonBlack.addEventListener('click', () => mudarMaterial('black'));
}

// Botão Material Cinza
const materialButtonGrey = document.getElementById('material-grey-btn');
if (materialButtonGrey) {
    materialButtonGrey.addEventListener('click', () => mudarMaterial('grey'));
}


// Botão para mudar a luminosidade
const lightButton = document.getElementById("light-btn");
let isNight = false;

if (lightButton) {
  lightButton.addEventListener("click", () => {
    isNight = !isNight;
    const cenaAlvo = typeof cena !== "undefined" ? cena : scene;

    if (isNight) {
      lightButton.innerText = "Modo Dia ☀️";
      cenaAlvo.background = new THREE.Color(0x222222); // cor anterior mais escura: 0x111111
      cenaAlvo.traverse((object) => {
        if (object.isAmbientLight) object.intensity = 0.2;
        if (object.isDirectionalLight) {
          object.intensity = 0.5;
          object.color.setHex(0x3333ff);
        }
      });
    } else {
      lightButton.innerText = "Modo Noite 🌙";
      cenaAlvo.background = new THREE.Color(0xdddddd); // cor anterior mais clara: 0xf0f0f0
      cenaAlvo.traverse((object) => {
        if (object.isAmbientLight) object.intensity = 3;
        if (object.isDirectionalLight) {
          object.intensity = 5;
          object.color.setHex(0xffffff);
        }
      });
    }
  });
}
