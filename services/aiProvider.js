export class AIProvider {
  constructor(options = {}) {
    this.options = options;
  }

  async generateResponse(history, userMessage) {
    throw new Error("Not implemented");
  }

  getName() {
    return "base";
  }
}
