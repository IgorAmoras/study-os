/** Canonical, stable scientific world-space positions. */
export const NODES = [
 {id:'control',title:'Engenharia de Controle',kind:'disciplina',description:'A região-mãe das ideias, métodos e experimentos de controle.',domain:'ENGENHARIA',p:[-4,0,0],r:1.22,symbol:'◈',color:'#8ecafc',links:['identification']},
 {id:'identification',title:'Identificação de Sistemas',kind:'região',description:'Modelagem e identificação de sistemas dinâmicos a partir de dados.',domain:'CONTROLE',p:[1,0,0],r:1.02,symbol:'◇',color:'#68c5ef',links:['control','duffing','koopman','sindy','gaussian']},
 {id:'duffing',title:'Oscilador de Duffing',kind:'sistema',description:'Sistema não linear usado como referência em seus experimentos de identificação.',domain:'SISTEMAS DINÂMICOS',p:[6,0,0],r:1.40,symbol:'✧',color:'#f5cd89',links:['identification','koopman','sindy','hamiltonian','experiment']},
 {id:'koopman',title:'Operador de Koopman',kind:'método',description:'Representação linear em espaço aumentado para investigar dinâmicas não lineares.',domain:'MÉTODOS ORIENTADOS A DADOS',p:[10,3.2,1],r:.84,symbol:'◉',color:'#78baff',links:['duffing','experiment']},
 {id:'sindy',title:'SINDy',kind:'método',description:'Identificação esparsa de equações governantes e comparação com lifting.',domain:'MÉTODOS ORIENTADOS A DADOS',p:[10,-3,-2],r:.78,symbol:'✣',color:'#ab9dff',links:['duffing','experiment']},
 {id:'hamiltonian',title:'Port-Hamiltonian',kind:'método',description:'Estruturas energéticas e modelos com estados ocultos e perturbações.',domain:'MODELOS FÍSICOS',p:[7,4.6,-5],r:.82,symbol:'⬡',color:'#74dfc3',links:['duffing']},
 {id:'experiment',title:'Experimentos e Artefatos',kind:'bancada',description:'Código, parâmetros, figuras e notas vinculados à investigação do Duffing.',domain:'PESQUISA',p:[13,0,2],r:.78,symbol:'▤',color:'#dca6f8',links:['duffing','koopman','sindy']},
 {id:'gaussian',title:'Processos Gaussianos',kind:'conceito',description:'Estudos de incerteza, modelagem e referências para a pesquisa.',domain:'MATEMÁTICA APLICADA',p:[2,-4.5,-5],r:.73,symbol:'◌',color:'#87ebaf',links:['identification']},
];
