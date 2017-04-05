export default class Field {
  constructor(validators, options={}) {
    
    // Disabled since doesn't work with uglify
    /*
    if (new.target === Field) {
      throw new Error('Cannot construct Field instances directly')
    }
    */

    const {
      allowEmpty,
      allowNil,
      hashKey,
      initialValue,
      partitionKey,
      sortKey
    } = options
    
    // Constructs the fields' validator functions
    this.validators = [].concat(validators).map((v) => {
      if (typeof v !== 'object' || v === null) {
        throw new Error('Validator needs to be an object with rule and description properties.')
      }
      
      const { description, rule } = v
      if (typeof rule !== 'function' && !(rule instanceof RegExp) && !(typeof rule === 'string')) {
        throw new Error('Validator rule needs to be either a function, a RegExp or a string')
      }
      if (typeof description !== 'string' || !description.length) {
        throw new Error('Validator description needs to be a non-empty string')
      }

      // If the rule is a function, then apply the function with value
      // If the rule is a RegExp or a string, then test value against generated RegExp
      return ({
        test: (
          typeof rule === 'function' ?
          ((value) => rule(value)) :
          ((value) => new RegExp(rule).test(value))
        ),
        errorMessage: description
      })
    })
    if (!this.validators.length) {
      throw new Error('This class has no validators!')
    }

    if (partitionKey || hashKey) {
      this.partitionKey = true
      this.hashKey = true
    }
    this.sortKey = sortKey
    if (this.sortKey && (this.sortKey === this.partitionKey)) {
      throw new Error('Sort key cannot be the same as primary key')
    }

    this.breakingValidators = {
      allowNil, allowEmpty
    }
    this.value = initialValue
  }

  // Strong validators, that interrupt the checking process if passing
  checkBreakingValidators() {
    const { allowNil, allowEmpty } = this.breakingValidators
    const { value } = this

    if (allowNil && value == null) { // allow both null and undefined
      return true
    }

    if (allowEmpty && typeof value === 'string' && value.length === 0) {
      return true
    }

    return false
  }

  getValidationErrors() {
    return (
      this.checkBreakingValidators() ?
      [] :
      this.validators.map((v) => (
        v.test(this.value) ? null : v.errorMessage
      ))
      .filter((errorMessage) => errorMessage !== null)
    )
  }

  validate() {
    return this.getValidationErrors().length === 0
  }

}

