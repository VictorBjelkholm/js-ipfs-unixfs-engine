'use strict'

const pull = require('pull-stream')
const CID = require('cids')
const b58Encode = require('bs58').encode

const createResolver = require('./resolve').createResolver

function pathBaseAndRest (path) {
  // Buffer -> raw multihash or CID in buffer
  let pathBase = path
  let pathRest = '/'

  if (Buffer.isBuffer(path)) {
    pathBase = (new CID(path)).toBaseEncodedString()
  }

  if (typeof path === 'string') {
    if (path.indexOf('/ipfs/') === 0) {
      path = pathBase = path.substring(6)
    }
    const subtreeStart = path.indexOf('/')
    if (subtreeStart > 0) {
      pathBase = path.substring(0, subtreeStart)
      pathRest = path.substring(subtreeStart)
    }
  } else if (CID.isCID(pathBase)) {
    pathBase = pathBase.toBaseEncodedString()
  }

  pathBase = (new CID(pathBase)).toBaseEncodedString()

  return {
    base: pathBase,
    rest: pathRest.split('/').filter(Boolean)
  }
}

const defaultOptions = {
  recurse: true
}

module.exports = (path, dag, _options) => {

  const options = Object.assign({}, defaultOptions, _options)

  let dPath
  try {
    dPath = pathBaseAndRest(path)
  } catch (err) {
    return pull.error(err)
  }

  return pull(
    pull.values([{
      multihash: new CID(dPath.base),
      name: dPath.base,
      path: dPath.base,
      pathRest: dPath.rest
    }]),
    createResolver(dag, options),
    pull.map((node) => ({
      path: finalPathFor(node),
      size: node.size,
      hash: node.hash,
      content: node.content
    }))
  )

  function finalPathFor(node) {
    if (!dPath.rest.length) {
      return node.path
    }

    const cutElements = [dPath.base].concat(dPath.rest.slice(0, dPath.rest.length - 1))
    const lengthToCut = join(cutElements).length
    let retPath = node.path.substring(lengthToCut)
    if (retPath.charAt(0) === '/') {
      retPath = retPath.substring(1)
    }
    if (!retPath) {
      retPath = dPath.rest[dPath.rest.length - 1] || dPath.base
    }
    return retPath
  }
}

function join(paths) {
  return paths.reduce((acc, path) => {
    if (acc.length) {
      acc += '/'
    }
    return acc + path
  }, '')
}