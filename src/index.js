/* eslint react/jsx-key: off */
import * as React from 'react';
import ReactDOM from 'react-dom';
import { InMemoryCache, ApolloClient, ApolloProvider } from '@apollo/client';
import { createHttpLink } from 'apollo-link-http';

import buildGraphQLProvider from 'ra-data-graphql';
import { introspection, introspectionOperationNames } from './introspection';
import { queryBuilder } from './queryBuilder';

import { Admin, Resource, Loading } from 'react-admin'; // eslint-disable-line import/no-unresolved

import i18nProvider from './i18nProvider';
import Layout from './Layout';
import users from './users';

class App extends React.Component {
    constructor() {
        super();
        this.state = { dataProvider: null, client: null };
    }
    componentDidMount() {
        const httpLink = createHttpLink({
            uri: 'https://graphql-compose.herokuapp.com/user/',
        });

        const defaultOptions = {};
        const client = new ApolloClient({
            link: httpLink,
            cache: new InMemoryCache(),
            defaultOptions,
        });

        this.setState({ client });

        buildGraphQLProvider({
            client,
            buildQuery: queryBuilder,
            resolveIntrospection: introspection,
            introspection: {
                operationNames: introspectionOperationNames,
                exclude: undefined,
                include: undefined,
            },
        }).then(dataProvider => this.setState({ dataProvider }));
    }

    render() {
        const { dataProvider, client } = this.state;

        if (!dataProvider) {
            // this is kind of a hack to show the loading layout before the app is actually loaded, so i18nProvider isn't initialized yet
            return (
                <Loading
                    loadingPrimary="Loading"
                    loadingSecondary="The page is loading, just a moment please"
                />
            );
        }

        // We wrap <Admin> in an <ApolloProvider> so we can make adhoc queries
        return (
            <Admin
                dataProvider={dataProvider}
                i18nProvider={i18nProvider}
                title="Example Admin"
                layout={Layout}
            >
                <Resource name="User" {...users} />
            </Admin>
        );
    }
}

ReactDOM.render(<App />, document.getElementById('root'));
