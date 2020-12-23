import { TypeKind } from 'graphql';
import gql from 'graphql-tag';
import {
    CREATE,
    GET_LIST,
    GET_ONE,
    GET_MANY,
    GET_MANY_REFERENCE,
    UPDATE,
    DELETE,
} from 'react-admin';
import inflection from 'inflection';
import _ from 'underscore';

console.log("GET_LIST", GET_LIST)

export const isSubObject = field => {
    return (
        field.type.kind === TypeKind.OBJECT ||
        (field.type.kind === TypeKind.LIST &&
            (field.type.ofType.kind === TypeKind.OBJECT ||
                field.type.ofType.kind === TypeKind.LIST)) ||
        (field.type.kind === TypeKind.NON_NULL &&
            (field.type.ofType.kind === TypeKind.OBJECT ||
                field.type.ofType.kind === TypeKind.LIST)) ||
        ((field.type.ofType && field.type.ofType.kind) === TypeKind.NON_NULL &&
            ((field.type.ofType &&
                field.type.ofType.ofType &&
                field.type.ofType.ofType.kind) === TypeKind.LIST ||
                (field.type.ofType &&
                    field.type.ofType.ofType &&
                    field.type.ofType.ofType.kind) === TypeKind.OBJECT))
    );
};

const getType = (type) => {
  if (type.kind === TypeKind.NON_NULL || type.kind === TypeKind.LIST) {
    return getFinalType(type.ofType);
  }

  return type;
};

const isResource = (field, resources) => {
    const type = getType(field.type);
    return resources.some(r => r.type.name === type.name);
};

const buildFieldList = (
    introspectionResults,
    resource,
    aorFetchType,
    depth = 0,
    originalResource
) => {
    const types = introspectionResults.types;
    const resources = introspectionResults.resources;
    if (!resource.type.fields) return;
    return resource.type.fields
        .filter(field => !field.name.startsWith('__'))
        .map(field => {
            try {
                if (isSubObject(field, types) && depth < 8) {
                    let typeToCheck = getType(field.type);
                    if (isResource(field, resources)) {
                        const type = types.find(
                            t => t.name === typeToCheck.name
                        );
                        const resource = introspectionResults.resources.find(
                            r => r.type.name === type.name
                        );
                        if (
                            type &&
                            resource &&
                            !(field.type.name === originalResource.type.name)
                        ) {
                            const subFields = buildFieldList(
                                introspectionResults,
                                resource,
                                aorFetchType,
                                depth + 1,
                                originalResource
                            );
                            return `${field.name} { ${subFields} }`;
                        }
                    } else {
                        const type = types.find(
                            t => t.name === typeToCheck.name
                        );
                        if (type && type.fields) {
                            // eslint-disable-next-line
                            let subFields = type.fields
                                .map(_type => {
                                    if (!isSubObject(_type, types)) {
                                        return _type.name;
                                    } else {
                                        if (isResource(_type, resources)) {
                                            const resource = introspectionResults.resources.find(
                                                r =>
                                                    r.type.name ===
                                                    _type.type.name
                                            );
                                            if (_type && resource) {
                                                const subFields = buildFieldList(
                                                    introspectionResults,
                                                    resource,
                                                    aorFetchType,
                                                    depth + 1,
                                                    originalResource
                                                );
                                                return `${
                                                    _type.name
                                                } { ${subFields} }`;
                                            }
                                        }
                                    }
                                })
                                .filter(item => item);
                            subFields = _.without(subFields, '_id');
                            if (subFields.length >= 1) {
                                return `${field.name} { ${subFields} }`;
                            } else {
                                return false;
                            }
                        }
                    }
                    return false;
                }
                if (field.name === '_id' && depth >= 1) {
                    return false;
                } else {
                    return field.name;
                }
            } catch (err) {
                console.log(err);
            }
            return false;
        })
        .filter(f => f !== false)
        .join(' ');
};

export const queryBuilder = introspectionResults => (
    aorFetchType,
    resourceName,
    params
) => {
    const resource = introspectionResults.resources.find(
        r => r.type.name === resourceName
    );
    var result = {};
    switch (aorFetchType) {
        case 'GET_LIST':
        case 'GET_MANY':
        case 'GET_MANY_REFERENCE':
            params.page = params.pagination.page;
            params.perPage = params.pagination.perPage;
            if (params.sort && params.sort.field) {
                if (params.sort.field === 'id') params.sort.field = '_id';
                params.sort = `${params.sort.field.toUpperCase()}_${params.sort.order.toUpperCase()}`;
            }
            result = {
                query: gql`query ${inflection.camelize(
                    resource[aorFetchType].name,
                    true
                )}($filter: FilterFindMany${resourceName}Input, $sort: SortFindMany${resourceName}Input, $page: Int, $perPage: Int) {
            data: ${inflection.camelize(
                resource[aorFetchType].name,
                true
            )}(filter: $filter, sort: $sort, page: $page, perPage: $perPage) {
              items {
                id: _id
                ${buildFieldList(
                    introspectionResults,
                    resource,
                    aorFetchType,
                    0,
                    resource
                )}
              }
              total: count
            }
          }`,
                variables: params,
                parseResponse: response => ({
                    data: response.data.data.items,
                    total: response.data.data.total,
                }),
            };
            break;
        case 'GET_ONE':
            result = {
                query: gql`query ${resource[aorFetchType].name}($id: ID!) {
            data: ${resource[aorFetchType].name}(nodeId: $id) {
              ${buildFieldList(
                  introspectionResults,
                  resource,
                  aorFetchType,
                  0,
                  resource
              )}
              id: nodeId
            }
          }`,
                variables: { id: params.id },
                parseResponse: response => ({
                    data: response.data.data,
                    id: response.data.data.id,
                }),
            };
            break;

        default:
            return undefined;
    }
    return result;
};
