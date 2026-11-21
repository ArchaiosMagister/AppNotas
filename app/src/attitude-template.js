// Modelo facilitado por el usuario, sin datos de estudiantes.
export const ATTITUDE_2BACH_CRITERIA = [
  {
    "name": "Asistencia y puntualidad",
    "weight": 20,
    "maxScore": 2,
    "levels": [
      {
        "label": "Bien",
        "score": 2,
        "description": "Asiste a clase con regularidad, es puntual y justifica las faltas de asistencia."
      },
      {
        "label": "Regular",
        "score": 1,
        "description": "Entre 1 y 3 faltas o retrasos sin justificar."
      },
      {
        "label": "Mal",
        "score": 0,
        "description": "3 o más retrasos o faltas sin justificar."
      }
    ]
  },
  {
    "name": "Participación en clase",
    "weight": 20,
    "maxScore": 2,
    "levels": [
      {
        "label": "Bien",
        "score": 2,
        "description": "Participa activamente, responde a las preguntas y colabora en las actividades propuestas."
      },
      {
        "label": "Regular",
        "score": 1,
        "description": "Participa de forma irregular o solo cuando se le solicita."
      },
      {
        "label": "Mal",
        "score": 0,
        "description": "No participa, no colabora o interrumpe el desarrollo de las actividades."
      }
    ]
  },
  {
    "name": "Realización de tareas en clase y en casa",
    "weight": 20,
    "maxScore": 2,
    "levels": [
      {
        "label": "Bien",
        "score": 2,
        "description": "Realiza las tareas propuestas, trae el cuaderno y el diccionario y lleva el trabajo al día."
      },
      {
        "label": "Regular",
        "score": 1,
        "description": "Realiza las tareas de forma irregular o se olvida ocasionalmente del material necesario."
      },
      {
        "label": "Mal",
        "score": 0,
        "description": "No realiza habitualmente las tareas o acude reiteradamente sin el cuaderno o el diccionario."
      }
    ]
  },
  {
    "name": "Atención en clase",
    "weight": 20,
    "maxScore": 2,
    "levels": [
      {
        "label": "Bien",
        "score": 2,
        "description": "Atiende a las explicaciones, sigue las actividades y trabaja exclusivamente en la materia que se imparte."
      },
      {
        "label": "Regular",
        "score": 1,
        "description": "Se distrae ocasionalmente o necesita recordatorios para centrarse en la materia."
      },
      {
        "label": "Mal",
        "score": 0,
        "description": "Se distrae continuamente, estudia otras materias o impide el normal desarrollo de la clase."
      }
    ]
  },
  {
    "name": "Uso del móvil",
    "weight": 20,
    "maxScore": 2,
    "levels": [
      {
        "label": "Bien",
        "score": 2,
        "description": "Mantiene el móvil guardado y no lo utiliza durante la clase, salvo autorización expresa del profesor."
      },
      {
        "label": "Mal",
        "score": 0,
        "description": "Utiliza el móvil sin autorización de forma reiterada, pese a las indicaciones del profesor."
      }
    ]
  }
];
