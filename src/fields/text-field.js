import Field from './field'


export default class TextField extends Field {
  constructor(options) {
    const validators = {
      description: 'Needs to be a string',
      rule: (val) => typeof val === 'string'
    }
    super(validators, options)
  }
}

