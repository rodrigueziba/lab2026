"use client";
// Z70: id de sección (lib/debugSecciones.ts) → componente. Cada componente vive en components/debug/pestanas/.
import type { ComponentType } from "react";
import { SecDiagonalspot, SecHacesN3R2V1, SecLucesDelVisualizadorZ42, SecU6aAnillosEnPiso, SecU6bDestelloDelHaz } from "./pestanas/luces";
import { SecPrism, SecPrismProximity, SecPrismaYFlorZ54, SecBaseDeLaFlorZ67, SecFractalDelPrismaZ43 } from "./pestanas/flor";
import { SecDomeVisualizer, SecFluirDeColorZ61, SecComposicionDelDomoZ49, SecPanoramaT2CrecimientoDeGrupos, SecU4Sol, SecU4Montanas, SecU4Cielo, SecU4Lineas, SecU5LineasLiquidas, SecU7CapasVisibles, SecU10aParallaxPorCapa, SecAa1DomoOriginal, SecW1DomoDeShader, SecW2MultiplicadoresDeGrupo, SecW4DomeskyAjusteDeShader, SecW5SiluetasSuaves, SecX2DomoDiagnostico } from "./pestanas/composicion";
import { SecLegado, SecSimbolosN3, SecAudioBandasN4, SecReaccionT3Audio, SecU10bReaccionAlSonido, SecU11CameraFeedback, SecU2AgcAmplitudes } from "./pestanas/visualizador";
import { SecSecuenciaSillas, SecIconosDelPisoZ23, SecLayoutZ41, SecRelojDeLaExperienciaZ39, SecMovimientoZ34 } from "./pestanas/sala";
import { SecSolN3, SecOndasPorKickZ52, SecSolNuevoZ51 } from "./pestanas/sol";
import { SecMonolitosN5V1V2V3, SecPastoZ64 } from "./pestanas/pasto";
import { SecTelonN6, SecInicioZ24, SecTextoDelTelonZ46, SecDestelloDeCortinaF1, SecEntradaTrasElTelonZ59 } from "./pestanas/telon";
import { SecPanelesSillasP1, SecOrbitasZ7PanelesSillas, SecLinternaZ2PanelesSillas, SecAcercamientoZ8, SecPrioridadZ10ProyectoAbiertoSobreLas, SecVideoEtapa1, SecFocoZ19SubpanelAgrandado, SecSubpanelesZ4HistoriaGaleriaFicha } from "./pestanas/paneles";
import { SecCheckpointsZ40, SecEfectosDelDialogoZ29, SecCaminoLuzZ28, SecDialogoZ27 } from "./pestanas/narrativa";
import { SecCicloDeDiaZ48, SecCieloEstrelladoZ30, SecU9SecuenciaAmanecer, SecAmanecerZ38, SecW3AmanecerDomesky } from "./pestanas/cielo";
import { SecRendimientoZ66, SecPostProcesoR4 } from "./pestanas/rendimiento";
import { SecDebugOverlays } from "./pestanas/otros";
import { SecStars, SecDome, SecSectorEffects, SecLecterns, SecRetroAtriles, SecFaceCapture, SecAudio, SecExtraLights } from "./pestanas/tarima";

export const COMPONENTES_SECCION: Record<string, ComponentType> = {
  "diagonalspot": SecDiagonalspot,
  "haces-n3-r2-v1": SecHacesN3R2V1,
  "luces-del-visualizador-z42": SecLucesDelVisualizadorZ42,
  "u6a-anillos-en-piso": SecU6aAnillosEnPiso,
  "u6b-destello-del-haz": SecU6bDestelloDelHaz,
  "prism": SecPrism,
  "prism-proximity": SecPrismProximity,
  "prisma-y-flor-z54": SecPrismaYFlorZ54,
  "base-de-la-flor-z67": SecBaseDeLaFlorZ67,
  "fractal-del-prisma-z43": SecFractalDelPrismaZ43,
  "dome-visualizer": SecDomeVisualizer,
  "fluir-de-color-z61": SecFluirDeColorZ61,
  "composicion-del-domo-z49": SecComposicionDelDomoZ49,
  "panorama-t2-crecimiento-de-grupos": SecPanoramaT2CrecimientoDeGrupos,
  "u4-sol": SecU4Sol,
  "u4-montanas": SecU4Montanas,
  "u4-cielo": SecU4Cielo,
  "u4-lineas": SecU4Lineas,
  "u5-lineas-liquidas": SecU5LineasLiquidas,
  "u7-capas-visibles": SecU7CapasVisibles,
  "u10a-parallax-por-capa": SecU10aParallaxPorCapa,
  "aa1-domo-original": SecAa1DomoOriginal,
  "w1-domo-de-shader": SecW1DomoDeShader,
  "w2-multiplicadores-de-grupo": SecW2MultiplicadoresDeGrupo,
  "w4-domesky-ajuste-de-shader": SecW4DomeskyAjusteDeShader,
  "w5-siluetas-suaves": SecW5SiluetasSuaves,
  "x2-domo-diagnostico": SecX2DomoDiagnostico,
  "legado": SecLegado,
  "simbolos-n3": SecSimbolosN3,
  "audio-bandas-n4": SecAudioBandasN4,
  "reaccion-t3-audio": SecReaccionT3Audio,
  "u10b-reaccion-al-sonido": SecU10bReaccionAlSonido,
  "u11-camera-feedback": SecU11CameraFeedback,
  "u2-agc-amplitudes": SecU2AgcAmplitudes,
  "secuencia-sillas": SecSecuenciaSillas,
  "iconos-del-piso-z23": SecIconosDelPisoZ23,
  "layout-z41": SecLayoutZ41,
  "reloj-de-la-experiencia-z39": SecRelojDeLaExperienciaZ39,
  "movimiento-z34": SecMovimientoZ34,
  "sol-n3": SecSolN3,
  "ondas-por-kick-z52": SecOndasPorKickZ52,
  "sol-nuevo-z51": SecSolNuevoZ51,
  "monolitos-n5-v1-v2-v3": SecMonolitosN5V1V2V3,
  "pasto-z64": SecPastoZ64,
  "telon-n6": SecTelonN6,
  "inicio-z24": SecInicioZ24,
  "texto-del-telon-z46": SecTextoDelTelonZ46,
  "destello-de-cortina-f1": SecDestelloDeCortinaF1,
  "entrada-tras-el-telon-z59": SecEntradaTrasElTelonZ59,
  "paneles-sillas-p1": SecPanelesSillasP1,
  "orbitas-z7-paneles-sillas": SecOrbitasZ7PanelesSillas,
  "linterna-z2-paneles-sillas": SecLinternaZ2PanelesSillas,
  "acercamiento-z8": SecAcercamientoZ8,
  "prioridad-z10-proyecto-abierto-sobre-las": SecPrioridadZ10ProyectoAbiertoSobreLas,
  "video-etapa-1": SecVideoEtapa1,
  "foco-z19-subpanel-agrandado": SecFocoZ19SubpanelAgrandado,
  "subpaneles-z4-historia-galeria-ficha": SecSubpanelesZ4HistoriaGaleriaFicha,
  "checkpoints-z40": SecCheckpointsZ40,
  "efectos-del-dialogo-z29": SecEfectosDelDialogoZ29,
  "camino-luz-z28": SecCaminoLuzZ28,
  "dialogo-z27": SecDialogoZ27,
  "ciclo-de-dia-z48": SecCicloDeDiaZ48,
  "cielo-estrellado-z30": SecCieloEstrelladoZ30,
  "u9-secuencia-amanecer": SecU9SecuenciaAmanecer,
  "amanecer-z38": SecAmanecerZ38,
  "w3-amanecer-domesky": SecW3AmanecerDomesky,
  "rendimiento-z66": SecRendimientoZ66,
  "post-proceso-r4": SecPostProcesoR4,
  "debug-overlays": SecDebugOverlays,
  "stars": SecStars,
  "dome": SecDome,
  "sector-effects": SecSectorEffects,
  "lecterns": SecLecterns,
  "retro-atriles": SecRetroAtriles,
  "face-capture": SecFaceCapture,
  "audio": SecAudio,
  "extra-lights": SecExtraLights,
};
