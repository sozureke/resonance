export interface Concert {
  id: string           // ID_ev_booking
  date_start: string   // ISO 8601 datetime
  title: string
  subtitle: string
  room: string
  tag1: string         // tag1_E
  tag2: string         // tag2_E
  genre: string
  cast_full: string
  program_full: string
}

export interface JourneyConcert extends Concert {
  bridge: string       // Claude-generated narrative bridge
}

export interface Journey {
  journey_title: string
  concerts: JourneyConcert[]
}
