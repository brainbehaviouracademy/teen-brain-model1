/* Teaching content + anatomical layout. Loaded before app.js. */

"use strict";
/* ============================================================================
   THE TEEN BRAIN — interactive 3D teaching tool
   Single-file build for Brain Behaviour Academy.

   Architecture:
     1. Data model  — every region/structure + its teaching content.
     2. Scene setup — renderer, camera, lights, custom orbit controls.
     3. Brain build — procedural noise-displaced cortex + inner structures.
     4. Pathways    — glowing fibres with bidirectional particle flow.
     5. Labels      — HTML chips projected from 3D positions each frame.
     6. Interaction — raycast picking, panels, toggles, explode, scenario.
   ============================================================================ */

/* ---------------------------------------------------------------------------
   1. DATA MODEL
   pos = local position inside the brain (units ~ brain radius 1.4).
   side: if 'mirror', the structure is duplicated on left + right hemisphere.
--------------------------------------------------------------------------- */
const RATIONAL = {
  key:"rational", system:"r",
  title:"Rational Mind", sub:"Prefrontal Cortex",
  tag:"Executive control centre",
  functions:["Logical thinking","Reasoning","Planning","Decision making","Problem solving",
    "Self-control","Delayed gratification","Goal setting","Attention regulation","Judgement",
    "Impulse control","Risk assessment","Moral reasoning","Prioritization","Time management",
    "Working memory","Future thinking","Emotional regulation"],
  insight:"The Prefrontal Cortex is still developing during adolescence and usually matures fully in the mid-20s.",
};

const EMOTIONAL = {
  key:"emotional", system:"e",
  title:"Emotional Mind", sub:"Limbic System",
  tag:"Feeling & reward centre",
  functions:["Emotion generation","Emotional reactions","Reward seeking","Motivation","Pleasure",
    "Fear processing","Threat detection","Social emotions","Memory formation","Stress response",
    "Emotional learning","Survival instincts","Attachment and bonding","Sensation seeking","Novelty seeking"],
  insight:"The Emotional Brain develops earlier and is highly active during adolescence, often making emotions stronger and more intense.",
};

// Prefrontal sub-regions (hotspots on the frontal lobe).
const RATIONAL_PARTS = [
  { id:"dlpfc", name:"Dorsolateral Prefrontal Cortex (DLPFC)", system:"r", side:"mirror",
    pos:[0.52,0.42,0.96],
    functions:["Working memory","Planning","Attention control","Abstract reasoning"],
    relevance:"Helps a teen hold a goal in mind and resist distraction while studying or making a plan.",
    example:"Keeping your essay outline in mind while ignoring notifications." },
  { id:"vmpfc", name:"Ventromedial Prefrontal Cortex (VMPFC)", system:"r", side:"single",
    pos:[0,-0.05,1.12],
    functions:["Value-based choices","Emotional regulation","Self-reflection","Empathy"],
    relevance:"Weighs how a decision will feel later, helping calm strong emotions.",
    example:"Pausing before sending an angry text, sensing you'd regret it." },
  { id:"ofc", name:"Orbitofrontal Cortex (OFC)", system:"r", side:"mirror",
    pos:[0.26,-0.34,1.02],
    functions:["Reward evaluation","Impulse control","Social judgement","Adapting to consequences"],
    relevance:"Learns from outcomes and updates choices — still being fine-tuned in the teen years.",
    example:"Realising a shortcut backfired last time, so choosing differently now." },
  { id:"acc", name:"Anterior Cingulate Cortex (ACC)", system:"r", side:"single",
    pos:[0,0.22,0.58],
    functions:["Error detection","Conflict monitoring","Motivation","Linking emotion & control"],
    relevance:"Acts as a bridge between feeling and thinking — flags when something feels off.",
    example:"That 'wait, this is risky' signal right before you act." },
];

// Limbic structures (inside the brain, visible through the translucent cortex).
const EMOTIONAL_PARTS = [
  { id:"amygdala", name:"Amygdala", system:"e", side:"mirror",
    pos:[0.36,-0.22,0.30], size:0.10,
    functions:["Fear","Anger","Emotional reactions","Threat detection"],
    relevance:"May trigger quick emotional reactions before rational thinking fully engages.",
    example:"You receive criticism and react immediately before thinking." },
  { id:"hippocampus", name:"Hippocampus", system:"e", side:"mirror",
    pos:[0.46,-0.30,-0.06], size:0.11, shape:"curve",
    functions:["Memory formation","Learning","Linking memory to emotion","Spatial memory"],
    relevance:"Ties strong feelings to memories, so emotional events are remembered vividly.",
    example:"Remembering exactly where you were when you got exciting news." },
  { id:"hypothalamus", name:"Hypothalamus", system:"e", side:"single",
    pos:[0,-0.34,0.16], size:0.09,
    functions:["Stress response","Hormone control","Hunger & sleep","Body regulation"],
    relevance:"Drives the surge of stress hormones that make teen emotions feel physical.",
    example:"Heart racing and stomach flipping before a performance." },
  { id:"accumbens", name:"Nucleus Accumbens", system:"e", side:"mirror",
    pos:[0.20,-0.24,0.46], size:0.085,
    functions:["Reward","Pleasure","Motivation","Wanting / craving"],
    relevance:"Extra-sensitive in teens, making rewards and 'likes' feel intensely good.",
    example:"The rush of excitement from a notification or a win in a game." },
  { id:"vta", name:"Ventral Tegmental Area (VTA)", system:"e", side:"single",
    pos:[0,-0.44,-0.14], size:0.08,
    functions:["Dopamine release","Reward signalling","Motivation","Reinforcement"],
    relevance:"Pumps out dopamine that powers reward-seeking and novelty during adolescence.",
    example:"Feeling pulled to try something new and exciting, even if risky." },
  { id:"insula", name:"Insula", system:"e", side:"mirror",
    pos:[0.72,-0.04,0.16], size:0.10,
    functions:["Body awareness","Disgust","Empathy","Gut feelings"],
    relevance:"Turns body sensations into felt emotions — that 'gut feeling' teens often act on.",
    example:"A sinking feeling in your stomach telling you something's wrong." },
];

const COMPARISON = [
  ["Thinks","Feels"],["Plans","Reacts"],["Considers consequences","Seeks rewards"],
  ["Delays gratification","Wants immediate rewards"],["Logical","Emotional"],
  ["Long-term focus","Short-term focus"],["Self-control","Impulsivity"],
];

const TIMELINE = [
  { age:"Age 0–10",  what:"Rapid brain growth — connections form at lightning speed.", cls:"" , focus:"none"},
  { age:"Age 10–15", what:"Limbic system highly active — emotions run strong.", cls:"e", focus:"emotional"},
  { age:"Age 15–20", what:"Increased reward sensitivity — thrills feel especially good.", cls:"e", focus:"reward"},
  { age:"Age 20–25", what:"Prefrontal cortex maturation — judgement strengthens.", cls:"r", focus:"rational"},
  { age:"Age 25+",   what:"Full executive functioning — thinking & feeling in balance.", cls:"b", focus:"both"},
];
