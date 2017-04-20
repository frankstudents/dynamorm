import AWS from 'aws-sdk'

const docClient = new AWS.DynamoDB.DocumentClient({
  region: process.env.AWS_REGION || 'eu-west-1'
})

/**
 * Abstract model with support for attribute value pair validation.
 * 
 * Used as a base for the DynamoDB model, but can also be used for any other model requiring validation logic.
 */
export class Model {
  /**
   * Constructor.
   * 
   * @param {Object} schema The model schema to use for attribute validation.
   * @param {Object} initialValues Optional initial values to populate the model with.
   */
  constructor(schema, initialValues={}) {
    this._schema = schema
    this._errors = []
    this.populate(initialValues)
  }

  /**
   * Populate the model with the given attribute value pairs.
   * 
   * Only attributes that are defined in the schema are populated.
   * 
   * @param {Object} values Map of attribute value pairs. 
   */
  populate(values) {
    for (const v of Object.entries(values)) {
      const name = v[0]
      const value = v[1]
      if (this._schema.meta.props.hasOwnProperty(name)) {
        this[name] = value
      }
    }
    return this
  }

  /**
   * Returns the attribute value pairs defined for the model.
   * 
   * Only attributes that are defined in the schema are returned.
   * 
   * @returns {Object}
   */
  getAttributes() {
    const attributes = {}
    for (const prop of Object.entries(this._schema.meta.props)) {
      const name = prop[0]
      if (this.hasOwnProperty(name)) {
        attributes[name] = this[name]
      }
    }
    return attributes
  }

  /**
   * Validates the model according to the schema.
   * 
   * Requires the schema to be an instantiable object that takes this model as an argument, 
   * validates the attributes, and throws an Error for the first found invalid attribute.
   * 
   * This function populates the models error list, which aftwards can be fetched to display the errors.
   * 
   * @returns {Boolean} true if all validation rules pass, false otherwise.
   */
  validate() {
    this._errors = []
    try {
      new this._schema(this)
      return true
    } catch (err) {
      this._errors.push(err.message)
      return false
    }
  }

  /**
   * Returns any validation errors for the model.
   * 
   * Requires the use of `this.validate()` before any error are populated.
   * 
   * @returns {Array}
   */
  getValidationErrors() {
    return this._errors || []
  }
}

/**
 * Abstract model that represents a single row in a DynamoDB table.
 * 
 * The model follows the Active Record (AR) pattern.
 */
export class DbModel extends Model {
  /**
   * Constructor.
   * 
   * @param {Object} schema The model schema to use for attribute validation.
   * @param {Object} initialValues Optional initial values to populate the model with.
   */
  constructor(schema, initialValues={}) {
    super(schema, initialValues)

    this.tableName = [process.env.project, process.env.stage, this.constructor.name]
      .filter((p) => p !== undefined)
      .join('-')
  }

  /**
   * Setter for the model table name in DynamoDB.
   * 
   * @param {String} tableName The name of the DynamoDb table.
   */
  set tableName(tableName) {
    this._tableName = tableName
  }

  /**
   * Setter for the partition key in the DynamoDB table.
   * 
   * @param {String} partitionKey The name of the partition key.
   */
  set partitionKey(partitionKey) {
    this._partitionKey = partitionKey
  }

  /**
   * Setter for the sort key in the DynamoDB table.
   * 
   * @param {String} sortKey The name of the sort key.
   */
  set sortKey(sortKey) {
    this._sortKey = sortKey
  }

  /**
   * Persists the model instance to DynamoDB.
   * 
   * Only the attributes defined in the model schema are persisted after successful validation.
   * 
   * @returns {Promise}
   */
  save() {
    return DbModel._putItem(this)
  }

  /**
   * Returns a model based on it's primary key.
   * 
   * @param {String} partitionKey The partition key to fetch the model by.
   * @param {String} sortKey Optional sort key to fetch the model by (composite primary key).
   * 
   * @returns {DbModel}
   */
  static async findByPk(partitionKey, sortKey) {
    const model = new this()
    const options = { Key: {} }
    options.Key[model._partitionKey] = partitionKey
    if (sortKey) {
      options.Key[model._sortKey] = sortKey
    }
    const item = await DbModel._getItem(model, options)
    return item ? model.populate(item) : item
  }

  /**
   * Returns a list of models based on given primary key. 
   * 
   * @param {Array} partitionKeys  List of partition keys to fetch the models by.
   * @param {Array} sortKeys Optional list of sort keys to fetch the models by (composite primary key). 
   * 
   * @returns {Promise<Array>}
   */
  static async findAllByPk(partitionKeys, sortKeys) {
    const model = new this()
    const options = { Keys: [] }
    for (let i = 0, l =  partitionKeys.length; i < l; i++) {
      if (partitionKeys[i]) {
        const key = {}
        key[model._partitionKey] = partitionKeys[i]
        if (sortKeys && sortKeys.length && sortKeys[i]) {
          key[model._sortKey] = sortKeys[i]
        }
        options.Keys.push(key)
      }
    }

    const items = await DbModel._batchGetItems(model, options)
    const models = []
    items.forEach((item) => models.push(new this(item)))
    return models
  }

  /**
   * Returns a list of models based on query expression.
   * 
   * Usage:
   * 
   * findAllBy('attr = :attr', { ':attr': 'value' })
   * 
   * @param {String} expression The expression to query items by.
   * @param {Object} values The values to replace in the expression.
   * @param {Object} opts Optional options object for the query.
   * 
   * @returns {Promise<Array>}
   */
  static async findAllBy(expression, values, opts={}) {
    const model = new this()
    const options = { 
      KeyConditionExpression: expression,
      ExpressionAttributeValues: values,
      ...opts
    }

    const items = await DbModel._queryItems(model, options)
    const models = []
    items.forEach((item) => models.push(new this(item)))
    return models
  }

  /**
   * Returns a set of attributes for the item with the given primary key. If there is no matching item, undefined is returned.
   * 
   * @param {DbModel} model The DynamoDB model to fetch the item for.
   * @param {Object} opts Options object defining the Key to fetch the item by.
   * 
   * @returns {Promise<Object>}
   * 
   * @see http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB.html#getItem-property
   */
  static _getItem(model, opts={}) {
    const options = {
      TableName: model._tableName,
      ...opts
    }

    return docClient.get(options).promise()
      .then((data) => (data.Item))
  }

  /**
   * Returns the attributes of one or more items from the given models table. Requested items are identified by their primary key.
   * 
   * @param {DbModel} model The DynamoDB model to fetch the items for.
   * @param {Object} opts Options object defining the Keys to fetch the items by.
   * 
   * @returns {Promise<Array>}
   * 
   * @see http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB.html#batchGetItem-property
   */
  static _batchGetItems(model, opts={}) {
    const options = { RequestItems: {} }
    options.RequestItems[model._tableName] = {
      ...opts
    }

    // TODO: A single operation can retrieve up to 16 MB of data, which can contain as many as 100 items. 
    // BatchGetItem will return a partial result if the response size limit is exceeded, the table's provisioned throughput is exceeded, 
    // or an internal processing failure occurs. If a partial result is returned, the operation returns a value for UnprocessedKeys. 
    // You can use this value to retry the operation starting with the next item to get.
    return docClient.batchGet(options).promise()
      .then((data) => (data.Responses[model._tableName]))
  }

  /**
   * A Query operation uses the primary key of a table or a secondary index to directly access items from that table or index.
   * 
   * @param {DbModel} model The model to query for. 
   * @param {Object} opts Options object defining the query.
   * 
   * @returns {Promise<Array>}
   * 
   * @see http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB.html#query-property
   */
  static _queryItems(model, opts={}) {
    const options = {
      TableName: model._tableName,
      ...opts
    }

    return docClient.query(options).promise()
      .then(async (data) => {
        let result = data.Items
        if (data.LastEvaluatedKey) {
          opts.ExclusiveStartKey = data.LastEvaluatedKey
          const items = await DbModel._queryItems(model, opts)
          result = result.concat(items)
        } 
        return result
      })
  }

  /**
   * Creates a new item, or replaces an old item with a new item.
   * 
   * If an item that has the same primary key as the new item already exists in the specified table, the new item completely replaces 
   * the existing item. You can perform a conditional put operation (add a new item if one with the specified primary key doesn't exist), 
   * or replace an existing item if it has certain attribute values.
   * 
   * @param {DbModel} model The DynamoDB model to put the item for.
   * @param {Object} opts Options object for the put operation.
   * 
   * @returns {Promise<Object>}
   * 
   * @see http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB.html#putItem-property
   */
  static _putItem(model, opts={}) {
    return new Promise((resolve, reject) => {
      if (!model.validate()) {
        return reject(new Error(model.getValidationErrors()[0]))
      }

      const options = {
        TableName: model._tableName,
        Item: model.getAttributes(),
        ReturnValues: 'NONE',
        ...opts
      }

      return docClient.put(options).promise()
        .then((data) => resolve(data))
        .catch((error) => reject(error))
    })
  }
}
