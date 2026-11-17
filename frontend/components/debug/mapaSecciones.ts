"use client";
// Z70: id de sección (lib/debugSecciones.ts) → componente. Cada componente vive en components/debug/pestanas/.
// Z73: las partes de una sección fusionada ("// subsección:") no están acá: las dibuja su sección.
import type { ComponentType } from "react";
import { SecControlDelDia, SecCicloDeDiaZ48, SecCieloEstrelladoZ30, SecAmanecerZ38 } from "./pestanas/cielo";
import { SecDomeVisualizer, SecFluirDeColorZ61, SecComposicionDelDomoZ49, SecShaderDelDomo } from "./pestanas/composicion";
import { SecPrismProximity, SecPrismaYFlorZ54, SecBaseDeLaFlorZ67, SecFractalDelPrismaZ43 } from "./pestanas/flor";
import { SecDiagonalspot, SecHacesN3R2V1, SecLucesDelVisualizadorZ42, SecU6aAnillosEnPiso, SecU6bDestelloDelHaz } from "./pestanas/luces";
import { SecCheckpointsZ40, SecEfectosDelDialogoZ29, SecCaminoLuzZ28, SecDialogoZ27, SecLuzHuidaZ76 } from "./pestanas/narrativa";
import { SecDebugOverlays } from "./pestanas/otros";
import { SecPanelesSillas, SecAcercamientoZ8, SecPrioridadZ10ProyectoAbiertoSobreLas, SecVideoEtapa1, SecFocoZ19SubpanelAgrandado, SecSubpanelesZ4HistoriaGaleriaFicha } from "./pestanas/paneles";
import { SecMonolitosN5V1V2V3, SecPastoZ64, SecPastoExtensionZ74 } from "./pestanas/pasto";
import { SecRendimientoZ66, SecPostProcesoR4 } from "./pestanas/rendimiento";
import { SecSecuenciaSillas, SecIconosDelPisoZ23, SecLayoutZ41, SecRelojDeLaExperienciaZ39, SecMovimientoZ34 } from "./pestanas/sala";
import { SecSolN3, SecOndasPorKickZ52, SecSolNuevoZ51 } from "./pestanas/sol";
import { SecStars, SecDome, SecSectorEffects, SecLecterns, SecRetroAtriles, SecFaceCapture, SecAudio, SecExtraLights, SecAudioNucleoZ78, SecPlayTarimaZ79, SecCajaRitmosZ80 } from "./pestanas/tarima";
import { SecTelonN6, SecInicioZ24, SecTextoDelTelonZ46, SecDestelloDeCortinaF1, SecEntradaTrasElTelonZ59 } from "./pestanas/telon";
import { SecSimbolosN3, SecAudioBandasN4, SecReaccionT3Audio, SecU10bReaccionAlSonido, SecU11CameraFeedback, SecU2AgcAmplitudes } from "./pestanas/visualizador";
import { SecPanoramaSvg, SecAmanecerViejo, SecLegado, SecPrism, SecControlesSinEfecto } from "./pestanas/obsoletos";

export const COMPONENTES_SECCION: Record<string, ComponentType> = {
  "control-del-dia": SecControlDelDia,
  "ciclo-de-dia-z48": SecCicloDeDiaZ48,
  "cielo-estrellado-z30": SecCieloEstrelladoZ30,
  "amanecer-z38": SecAmanecerZ38,
  "dome-visualizer": SecDomeVisualizer,
  "fluir-de-color-z61": SecFluirDeColorZ61,
  "composicion-del-domo-z49": SecComposicionDelDomoZ49,
  "shader-del-domo": SecShaderDelDomo,
  "prism-proximity": SecPrismProximity,
  "prisma-y-flor-z54": SecPrismaYFlorZ54,
  "base-de-la-flor-z67": SecBaseDeLaFlorZ67,
  "fractal-del-prisma-z43": SecFractalDelPrismaZ43,
  "diagonalspot": SecDiagonalspot,
  "haces-n3-r2-v1": SecHacesN3R2V1,
  "luces-del-visualizador-z42": SecLucesDelVisualizadorZ42,
  "u6a-anillos-en-piso": SecU6aAnillosEnPiso,
  "u6b-destello-del-haz": SecU6bDestelloDelHaz,
  "checkpoints-z40": SecCheckpointsZ40,
  "efectos-del-dialogo-z29": SecEfectosDelDialogoZ29,
  "camino-luz-z28": SecCaminoLuzZ28,
  "luz-huida-z76": SecLuzHuidaZ76,
  "dialogo-z27": SecDialogoZ27,
  "debug-overlays": SecDebugOverlays,
  "paneles-sillas": SecPanelesSillas,
  "acercamiento-z8": SecAcercamientoZ8,
  "prioridad-z10-proyecto-abierto-sobre-las": SecPrioridadZ10ProyectoAbiertoSobreLas,
  "video-etapa-1": SecVideoEtapa1,
  "foco-z19-subpanel-agrandado": SecFocoZ19SubpanelAgrandado,
  "subpaneles-z4-historia-galeria-ficha": SecSubpanelesZ4HistoriaGaleriaFicha,
  "monolitos-n5-v1-v2-v3": SecMonolitosN5V1V2V3,
  "pasto-z64": SecPastoZ64,
  "pasto-extension-z74": SecPastoExtensionZ74,
  "rendimiento-z66": SecRendimientoZ66,
  "post-proceso-r4": SecPostProcesoR4,
  "secuencia-sillas": SecSecuenciaSillas,
  "iconos-del-piso-z23": SecIconosDelPisoZ23,
  "layout-z41": SecLayoutZ41,
  "reloj-de-la-experiencia-z39": SecRelojDeLaExperienciaZ39,
  "movimiento-z34": SecMovimientoZ34,
  "sol-n3": SecSolN3,
  "ondas-por-kick-z52": SecOndasPorKickZ52,
  "sol-nuevo-z51": SecSolNuevoZ51,
  "stars": SecStars,
  "dome": SecDome,
  "sector-effects": SecSectorEffects,
  "lecterns": SecLecterns,
  "retro-atriles": SecRetroAtriles,
  "face-capture": SecFaceCapture,
  "audio": SecAudio,
  "audio-nucleo-z78": SecAudioNucleoZ78,
  "play-tarima-z79": SecPlayTarimaZ79,
  "caja-ritmos-z80": SecCajaRitmosZ80,
  "extra-lights": SecExtraLights,
  "telon-n6": SecTelonN6,
  "inicio-z24": SecInicioZ24,
  "texto-del-telon-z46": SecTextoDelTelonZ46,
  "destello-de-cortina-f1": SecDestelloDeCortinaF1,
  "entrada-tras-el-telon-z59": SecEntradaTrasElTelonZ59,
  "simbolos-n3": SecSimbolosN3,
  "audio-bandas-n4": SecAudioBandasN4,
  "reaccion-t3-audio": SecReaccionT3Audio,
  "u10b-reaccion-al-sonido": SecU10bReaccionAlSonido,
  "u11-camera-feedback": SecU11CameraFeedback,
  "u2-agc-amplitudes": SecU2AgcAmplitudes,
  "panorama-svg": SecPanoramaSvg,
  "amanecer-viejo": SecAmanecerViejo,
  "legado": SecLegado,
  "prism": SecPrism,
  "controles-sin-efecto": SecControlesSinEfecto,
};
