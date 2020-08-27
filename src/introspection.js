import { getIntrospectionQuery } from 'graphql';
import gql from 'graphql-tag';
import { ALL_TYPES } from 'ra-data-graphql';
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

export const introspectionOperationNames = {
    //schema,
    [GET_LIST]: resource => {
        return `${inflection.camelize(resource.name, true)}Pagination`;
    },
    [GET_ONE]: resource => {
        return `${inflection.camelize(resource.name, true)}One`;
    },
    [GET_MANY]: resource => resource => {
        return `${inflection.camelize(resource.name, true)}Pagination`;
    },
    [GET_MANY_REFERENCE]: resource => {
        return `${inflection.camelize(resource.name, true)}Pagination`;
    },
    [CREATE]: resource => `create${resource.name}`,
    [UPDATE]: resource => `update${resource.name}`,
    [DELETE]: resource => `delete${resource.name}`,
};

export const filterTypesByIncludeExclude = ({ include, exclude }) => {
    if (Array.isArray(include)) {
        return type => include.includes(type.name);
    }

    if (typeof include === 'function') {
        return type => include(type);
    }

    if (Array.isArray(exclude)) {
        return type => !exclude.includes(type.name);
    }

    if (typeof exclude === 'function') {
        return type => !exclude(type);
    }

    return () => true;
};

/**
 * @param {ApolloClient} client The Apollo client
 * @param {Object} options The introspection options
 */
export const introspection = async (client, options) => {
    // console.log("custom introspection", client, options)
    const schema = options.schema
        ? options.schema
        : await client
              .query({
                  fetchPolicy: 'network-only',
                  query: gql`
                      ${getIntrospectionQuery()}
                  `,
              })
              .then(({ data: { __schema } }) => __schema);

    const queries = schema.types.reduce((acc, type) => {
        if (
            type.name !== (schema.queryType && schema.queryType.name) &&
            type.name !== (schema.mutationType && schema.mutationType.name)
        )
            return acc;

        return [...acc, ...type.fields];
    }, []);

    const types = schema.types.filter(
        type =>
            type.name !== (schema.queryType && schema.queryType.name) &&
            type.name !== (schema.mutationType && schema.mutationType.name)
    );

    const isResource = type =>
        queries.some(
            query => query.name === options.operationNames[GET_LIST](type)
        ) &&
        queries.some(
            query => query.name === options.operationNames[GET_ONE](type)
        );

    const buildResource = type =>
        ALL_TYPES.reduce(
            (acc, aorFetchType) => ({
                ...acc,
                [aorFetchType]: queries.find(
                    query =>
                        options.operationNames[aorFetchType] &&
                        query.name ===
                            options.operationNames[aorFetchType](type)
                ),
            }),
            { type }
        );

    const potentialResources = types.filter(isResource);
    const filteredResources = potentialResources.filter(
        filterTypesByIncludeExclude(options)
    );
    const resources = filteredResources.map(buildResource);

    return {
        types,
        queries,
        resources,
        schema,
    };
};
