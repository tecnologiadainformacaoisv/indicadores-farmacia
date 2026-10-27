// Cadastro provisório dos equipamentos de saúde sob gestão do Instituto, por município.
// Fonte: UNIDADES-ISV.md (retrato de 20/10/2026, extraído da aba Equipamentos da pesquisa de satisfação).
// t = tipo (Hospital, UPA, UBS, CAPS, Outros); a = outros nomes da mesma unidade no painel.
// PROVISÓRIO: quando a aba Unidades do servidor tiver município e tipo, este arquivo some (ver docs/ATUALIZACAO-VISUAL.md).
// 152 equipamentos em 12 municípios.
const REDE_CATALOGO = [
 {
  "m": "Caucaia",
  "u": [
   {
    "n": "UPA Centro (Luiz Nerys)",
    "t": "UPA",
    "a": [
     "UPA Centro",
     "UPA Luiz Nerys"
    ]
   },
   {
    "n": "UPA Jurema",
    "t": "UPA"
   },
   {
    "n": "Hospital Municipal Abelardo Gadelha da Rocha",
    "t": "Hospital",
    "a": [
     "HMAGR",
     "Hospital Municipal Abelardo Gadelha"
    ]
   },
   {
    "n": "Hospital e Maternidade Santa Terezinha",
    "t": "Hospital",
    "a": [
     "HMST",
     "Maternidade Santa Terezinha"
    ]
   }
  ]
 },
 {
  "m": "Forquilha",
  "u": [
   {
    "n": "CAPS Almir Rufino de Souza",
    "t": "CAPS"
   },
   {
    "n": "CEO Municipal de Forquilha",
    "t": "Outros"
   },
   {
    "n": "José Valmir Araújo",
    "t": "Outros"
   },
   {
    "n": "Centro de Parto Normal Francisco Eliezer X. Rodrigues",
    "t": "Hospital"
   },
   {
    "n": "UBS Francisco Rufino de Sousa",
    "t": "UBS"
   },
   {
    "n": "UBS Maria das Dores Rodrigues Custódio",
    "t": "UBS"
   },
   {
    "n": "UBS Otília Lopes de Sousa",
    "t": "UBS"
   },
   {
    "n": "UBS Domingos Gomes de Jesus",
    "t": "UBS"
   },
   {
    "n": "UBS Adauto Araújo",
    "t": "UBS"
   },
   {
    "n": "UBS Antônio Faustino de Loiola",
    "t": "UBS"
   },
   {
    "n": "UBS Gerardo Ananias Guimarães",
    "t": "UBS"
   },
   {
    "n": "UBS Sebastião Rodrigues Monção",
    "t": "UBS"
   },
   {
    "n": "UBS Antero Mendes",
    "t": "UBS"
   },
   {
    "n": "Academia da Saúde - Unidade 1",
    "t": "Outros"
   },
   {
    "n": "Academia da Saúde - Centro",
    "t": "Outros"
   }
  ]
 },
 {
  "m": "Guaraciaba do Norte",
  "u": [
   {
    "n": "CEO Guaraciaba do Norte",
    "t": "Outros"
   },
   {
    "n": "Centro de Atenção Psicossocial",
    "t": "CAPS"
   },
   {
    "n": "Centro de Saúde I e II",
    "t": "UBS"
   },
   {
    "n": "ESF Campestre",
    "t": "UBS"
   },
   {
    "n": "Garrancho",
    "t": "UBS"
   },
   {
    "n": "Guarani",
    "t": "UBS"
   },
   {
    "n": "Hospital e Maternidade São José",
    "t": "Hospital"
   },
   {
    "n": "Limoeiro",
    "t": "UBS"
   },
   {
    "n": "Mocambo",
    "t": "UBS"
   },
   {
    "n": "Passagem das Pedras",
    "t": "UBS"
   },
   {
    "n": "UBS Bela Vista",
    "t": "UBS"
   },
   {
    "n": "UBS Estivas",
    "t": "UBS"
   },
   {
    "n": "UBS Lagoa dos Silvanos",
    "t": "UBS"
   },
   {
    "n": "UBS Lagoinha",
    "t": "UBS"
   },
   {
    "n": "UBS Martislândia",
    "t": "UBS"
   },
   {
    "n": "UBS Morrinhos",
    "t": "UBS"
   },
   {
    "n": "UBS Santo Antônio",
    "t": "UBS"
   },
   {
    "n": "UBS Sussuanha",
    "t": "UBS"
   },
   {
    "n": "UBS São Félix",
    "t": "UBS"
   },
   {
    "n": "UBS Várzea Redonda",
    "t": "UBS"
   },
   {
    "n": "UBS Várzea dos Espinhos",
    "t": "UBS"
   },
   {
    "n": "UBSF Centro de Nutrição",
    "t": "UBS"
   },
   {
    "n": "UBS Descoberta",
    "t": "UBS"
   },
   {
    "n": "UBS Alegre",
    "t": "UBS"
   }
  ]
 },
 {
  "m": "Iguatu",
  "u": [
   {
    "n": "Hospital de Iguatu",
    "t": "Hospital"
   }
  ]
 },
 {
  "m": "Lavras da Mangabeira",
  "u": [
   {
    "n": "Hospital São Vicente Ferrer",
    "t": "Hospital"
   },
   {
    "n": "UBS Lavras da Mangabeira",
    "t": "UBS"
   },
   {
    "n": "UBS Barbalha",
    "t": "UBS"
   },
   {
    "n": "UBS Arrojado",
    "t": "UBS"
   },
   {
    "n": "UBS Iborepi",
    "t": "UBS"
   },
   {
    "n": "UBS Ouro Branco",
    "t": "UBS"
   },
   {
    "n": "UBS Quitaius I",
    "t": "UBS"
   },
   {
    "n": "UBS Quitaius II",
    "t": "UBS"
   },
   {
    "n": "UBS Baixio",
    "t": "UBS"
   },
   {
    "n": "UBS Cuandu",
    "t": "UBS"
   },
   {
    "n": "NIA",
    "t": "Outros"
   },
   {
    "n": "NAIA",
    "t": "Outros"
   }
  ]
 },
 {
  "m": "Maracanaú",
  "u": [
   {
    "n": "Hospital da Mulher e da Criança Eneida Soares Pessoa",
    "t": "Hospital"
   },
   {
    "n": "Unidade de Atendimento 24hrs",
    "t": "UPA"
   }
  ]
 },
 {
  "m": "Massapé",
  "u": [
   {
    "n": "Anexo Baixio (CSF Aiuá)",
    "t": "UBS"
   },
   {
    "n": "Anexo Cachoeirinha (CSF Tangente)",
    "t": "UBS"
   },
   {
    "n": "Anexo Cacimba Velha de Baixo (CSF Tangente)",
    "t": "UBS"
   },
   {
    "n": "Anexo Cacimba Velha de Cima (CSF Tangente)",
    "t": "UBS"
   },
   {
    "n": "Anexo Cacimbinha (CSF Tangente)",
    "t": "UBS"
   },
   {
    "n": "Anexo Gregório (CSF Mirim)",
    "t": "UBS"
   },
   {
    "n": "Anexo Lagoa Grande (CSF Tuína)",
    "t": "UBS"
   },
   {
    "n": "Anexo Meruoquinha (CSF Mumbaba de Cima)",
    "t": "UBS"
   },
   {
    "n": "Anexo Morgado (CSF Salgadinho)",
    "t": "UBS"
   },
   {
    "n": "Anexo Paus Brancos (CSF Padre Linhares)",
    "t": "UBS"
   },
   {
    "n": "Anexo Riacho Fundo (CSF Pé da Serra)",
    "t": "UBS"
   },
   {
    "n": "Anexo São Damião (CSF Pé da Serra)",
    "t": "UBS"
   },
   {
    "n": "Anexo Sítio Recife (CSF Padre Linhares)",
    "t": "UBS"
   },
   {
    "n": "Anexo Sítio Socorro (CSF Pé da Serra)",
    "t": "UBS"
   },
   {
    "n": "Anexo Tapera Baixa (CSF Tuína)",
    "t": "UBS"
   },
   {
    "n": "CAPS",
    "t": "CAPS"
   },
   {
    "n": "CEO – Centro de Especialidades Odontológicas",
    "t": "Outros"
   },
   {
    "n": "CES",
    "t": "Outros"
   },
   {
    "n": "CSF Mirim",
    "t": "UBS"
   },
   {
    "n": "CSF Mumbaba de Baixo",
    "t": "UBS"
   },
   {
    "n": "CSF Mumbaba de Cima",
    "t": "UBS"
   },
   {
    "n": "CSF Padre Linhares",
    "t": "UBS"
   },
   {
    "n": "CSF Pé da Serra",
    "t": "UBS"
   },
   {
    "n": "CSF Salgadinho",
    "t": "UBS"
   },
   {
    "n": "CSF Sede I",
    "t": "UBS"
   },
   {
    "n": "CSF Sede II",
    "t": "UBS"
   },
   {
    "n": "CSF Sede III",
    "t": "UBS"
   },
   {
    "n": "CSF Sede IV",
    "t": "UBS"
   },
   {
    "n": "CSF Tangente",
    "t": "UBS"
   },
   {
    "n": "CSF Tuína",
    "t": "UBS"
   },
   {
    "n": "Espaço Acolher",
    "t": "CAPS"
   },
   {
    "n": "Hospital Municipal / Hospital Senador Ozires Pontes",
    "t": "Hospital"
   },
   {
    "n": "Vigilância Epidemiológica",
    "t": "Outros"
   }
  ]
 },
 {
  "m": "Orós",
  "u": [
   {
    "n": "CAPS Orós",
    "t": "CAPS"
   },
   {
    "n": "Hospital e Maternidade Luiza Teodoro da Costa",
    "t": "Hospital"
   },
   {
    "n": "UBS Orós",
    "t": "UBS"
   },
   {
    "n": "CEO Francisco Gabimar Bezerra",
    "t": "Outros"
   },
   {
    "n": "UBS Barra",
    "t": "UBS"
   },
   {
    "n": "UBS Caatinga",
    "t": "UBS"
   },
   {
    "n": "UBS Carnaubinha",
    "t": "UBS"
   },
   {
    "n": "UBS Jurema",
    "t": "UBS"
   },
   {
    "n": "UBS Caraúbas",
    "t": "UBS"
   },
   {
    "n": "UBS Caro Custou",
    "t": "UBS"
   },
   {
    "n": "UBS Guassusse",
    "t": "UBS"
   },
   {
    "n": "UBS Igaroi",
    "t": "UBS"
   },
   {
    "n": "UBS Palestina",
    "t": "UBS"
   },
   {
    "n": "UBS Santarem",
    "t": "UBS"
   },
   {
    "n": "UBS São Geraldo",
    "t": "UBS"
   },
   {
    "n": "UBS Cabeça de Negro Pai Antônio",
    "t": "UBS"
   },
   {
    "n": "UBS Pão de Açúcar",
    "t": "UBS"
   },
   {
    "n": "UBS Pedregulho",
    "t": "UBS"
   },
   {
    "n": "UBS Pereiro dos Pedros",
    "t": "UBS"
   },
   {
    "n": "UBS Rochedo",
    "t": "UBS"
   },
   {
    "n": "UBS Sítio Jardim",
    "t": "UBS"
   },
   {
    "n": "UBS Isaac Cândido",
    "t": "UBS"
   },
   {
    "n": "UBS Maria José Nunes",
    "t": "UBS"
   },
   {
    "n": "Vigilância Epidemiológica",
    "t": "Outros"
   },
   {
    "n": "Equipe de Atendimento Domiciliar - EMAD II",
    "t": "Outros"
   },
   {
    "n": "NASF",
    "t": "Outros"
   }
  ]
 },
 {
  "m": "Pacatuba",
  "u": [
   {
    "n": "Hospital Municipal Raimundo Célio Rodrigues",
    "t": "Hospital"
   }
  ]
 },
 {
  "m": "Pedra Branca",
  "u": [
   {
    "n": "Hospital Municipal São Sebastião",
    "t": "Hospital"
   }
  ]
 },
 {
  "m": "Tabuleiro do Norte",
  "u": [
   {
    "n": "Ana Rita Bezerra Maia Moreira",
    "t": "Outros"
   },
   {
    "n": "CAPS",
    "t": "CAPS"
   },
   {
    "n": "Centro de Reabilitação",
    "t": "Outros"
   },
   {
    "n": "Melhor em Casa",
    "t": "Outros"
   },
   {
    "n": "Centro de Epidemiologia",
    "t": "Outros"
   },
   {
    "n": "UBS Peixe Gordo",
    "t": "UBS"
   },
   {
    "n": "UBS Groelândia",
    "t": "UBS"
   },
   {
    "n": "UBS Gangorrinha",
    "t": "UBS"
   },
   {
    "n": "UBS José Mendes Sobrinho",
    "t": "UBS"
   },
   {
    "n": "UBS Maria de Fátima Freitas",
    "t": "UBS"
   },
   {
    "n": "UBS Alcides Monteiro Chaves",
    "t": "UBS"
   },
   {
    "n": "UBS Hilário Domingos",
    "t": "UBS"
   },
   {
    "n": "UBS Pedra Preta",
    "t": "UBS"
   },
   {
    "n": "UBS Barra do Feijão",
    "t": "UBS"
   }
  ]
 },
 {
  "m": "Várzea Alegre",
  "u": [
   {
    "n": "Núcleo Azul",
    "t": "CAPS"
   },
   {
    "n": "UBS Juremal",
    "t": "UBS"
   },
   {
    "n": "UBS Calabaça",
    "t": "UBS"
   },
   {
    "n": "UBS Canindezinho",
    "t": "UBS"
   },
   {
    "n": "UBS Naraniú",
    "t": "UBS"
   },
   {
    "n": "UBS Patos",
    "t": "UBS"
   },
   {
    "n": "UBS Varjota",
    "t": "UBS"
   },
   {
    "n": "UBS Riachinho",
    "t": "UBS"
   },
   {
    "n": "UBS Riacho Verde",
    "t": "UBS"
   },
   {
    "n": "CAPS",
    "t": "CAPS"
   },
   {
    "n": "CAIS / Centro de Especialidades",
    "t": "Outros"
   },
   {
    "n": "UBS Dep. Figueiredo Correia",
    "t": "UBS"
   },
   {
    "n": "UBS Francisco Rolim de Morais",
    "t": "UBS"
   },
   {
    "n": "UBS Juazeirinho",
    "t": "UBS"
   },
   {
    "n": "UBS Quatro Bocas",
    "t": "UBS"
   },
   {
    "n": "UBS Grossos",
    "t": "UBS"
   },
   {
    "n": "UBS Praça Santo Antônio",
    "t": "UBS"
   },
   {
    "n": "UBS Sanharol",
    "t": "UBS"
   },
   {
    "n": "UBS Ibicatu",
    "t": "UBS"
   }
  ]
 }
];
if (typeof window !== 'undefined') window.REDE_CATALOGO = REDE_CATALOGO;
if (typeof module !== 'undefined') module.exports = REDE_CATALOGO;
