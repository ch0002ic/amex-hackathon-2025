import type { InnovationIdea } from '../types/domain.js'
import { innovationIdeas } from '../data/innovationIdeas.js'

export async function getInnovationIdeas(): Promise<InnovationIdea[]> {
  return innovationIdeas
}
