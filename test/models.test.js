import t from 'tcomb'

import { DbModel, Model } from '../src/models'


class MockModel extends Model {
  constructor(initialValues={}) {
    const schema = t.struct({
      keyField: t.String,
      myTextField: t.String,
      optionalField: t.maybe(t.String)
    }, 'MockModel')
    super(schema, initialValues)
  }
}

class MockDbModel extends DbModel {
  constructor(initialValues={}) {
    const schema = t.struct({
      keyField: t.String,
      myTextField: t.String,
      optionalField: t.maybe(t.String)
    }, 'MockDbModel')

    super(schema, initialValues)

    this.tableName = 'custom-table-name'
    this.partitionKey = 'keyField'
  }
}

class MockDbModelWithoutTableName extends DbModel {
  constructor(initialValues={}) {
    const schema = t.struct({
      keyField: t.String,
      myTextField: t.String,
      optionalField: t.maybe(t.String)
    }, 'MockDbModel')

    super(schema, initialValues)
    this.partitionKey = 'keyField'
  }
}

const KEY_FIELD_VALUE = 'KEY_FIELD_VALUE'
const TEXT_FIELD_VALUE = 'TEXT_FIELD_VALUE'

test('Model field value setting and changing works', () => {
  const model = new MockModel()

  model.populate({
    keyField: KEY_FIELD_VALUE,
    myTextField: TEXT_FIELD_VALUE
  })
 
  expect(model.getAttributes()).toEqual({
    keyField: KEY_FIELD_VALUE,
    myTextField: TEXT_FIELD_VALUE
  })

  expect(model.optionalField).toBe(undefined)

  model.populate({
    keyField: TEXT_FIELD_VALUE,
    myTextField: KEY_FIELD_VALUE
  })

  expect(model.getAttributes()).toEqual({
    keyField: TEXT_FIELD_VALUE,
    myTextField: KEY_FIELD_VALUE,
    optionalField: undefined
  })

})

test('DbModel initial value setting works', () => {
  const model = new MockDbModel({
    keyField: KEY_FIELD_VALUE,
    myTextField: TEXT_FIELD_VALUE  
  })

  expect(model.getAttributes()).toEqual({
    keyField: KEY_FIELD_VALUE,
    myTextField: TEXT_FIELD_VALUE
  })
})

test('Model validation works', () => {
  const model = new MockModel()

  model.populate({
    keyField: KEY_FIELD_VALUE,
    myTextField: TEXT_FIELD_VALUE
  })
  expect(model.validate()).toBe(true)

  model.populate({
    optionalField: 123,
    keyField: null
  })

  expect(model.validate()).toBe(false)
  expect(model.getValidationErrors()[0]).toBe('[tcomb] Invalid value null supplied to MockModel/keyField: String')

  model.populate({
    keyField: KEY_FIELD_VALUE
  })
  expect(model.validate()).toBe(false)
  expect(model.getValidationErrors()[0]).toBe('[tcomb] Invalid value 123 supplied to MockModel/optionalField: ?String')

  const anotherModel = new MockModel({
    keyField: KEY_FIELD_VALUE,
    myTextField: TEXT_FIELD_VALUE
  })
  anotherModel.validate()
  expect(anotherModel.validate()).toBe(true)
})

test('Model tableName is generatable and settable', () => {
  const model = new MockDbModelWithoutTableName({
    keyField: KEY_FIELD_VALUE,
    myTextField: TEXT_FIELD_VALUE
  })
  expect(model._tableName).toBe('MyProject-MyStage-MockDbModelWithoutTableName')
})

