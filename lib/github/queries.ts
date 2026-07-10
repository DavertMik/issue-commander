// Raw GraphQL documents. Field names verified against docs.github.com.

const ISSUE_CONTENT_FIELDS = `
  id
  number
  title
  state
  createdAt
  closedAt
  url
  repository { nameWithOwner }
  milestone { number title }
  issueType { name }
  assignees(first: 10) { nodes { login avatarUrl } }
  labels(first: 20) { nodes { name color } }
`;

/** Resolve a project's node id by org login + number. */
export const PROJECT_ID_QUERY = /* GraphQL */ `
  query ProjectId($login: String!, $number: Int!) {
    organization(login: $login) {
      projectV2(number: $number) { id title }
    }
  }
`;

const SINGLE_SELECT_VALUE = `
  fieldValueByName(name: "Status") {
    __typename
    ... on ProjectV2ItemFieldSingleSelectValue { name optionId }
  }
`;

/** Paginated project items -> issue content (+ the item's Status field value). */
export const PROJECT_ITEMS_QUERY = /* GraphQL */ `
  query ProjectItems($projectId: ID!, $cursor: String) {
    node(id: $projectId) {
      ... on ProjectV2 {
        title
        number
        items(first: 100, after: $cursor) {
          pageInfo { hasNextPage endCursor }
          nodes {
            id
            type
            ${SINGLE_SELECT_VALUE}
            content {
              __typename
              ... on Issue { ${ISSUE_CONTENT_FIELDS} }
            }
          }
        }
      }
    }
  }
`;

/** Enrich a batch of issues with their project memberships + Status (repo/milestone panes). */
export const ENRICH_STATUS_QUERY = /* GraphQL */ `
  query EnrichStatus($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on Issue {
        id
        projectItems(first: 5) {
          nodes {
            id
            project { ... on ProjectV2 { id number title } }
            ${SINGLE_SELECT_VALUE}
          }
        }
      }
    }
  }
`;

/** The project's Status single-select field + its options (for the F7 editor). */
export const STATUS_FIELD_QUERY = /* GraphQL */ `
  query StatusField($projectId: ID!) {
    node(id: $projectId) {
      ... on ProjectV2 {
        field(name: "Status") {
          ... on ProjectV2SingleSelectField { id name options { id name } }
        }
      }
    }
  }
`;

export const UPDATE_ITEM_STATUS_MUTATION = /* GraphQL */ `
  mutation SetStatus($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
    updateProjectV2ItemFieldValue(
      input: { projectId: $projectId, itemId: $itemId, fieldId: $fieldId, value: { singleSelectOptionId: $optionId } }
    ) {
      projectV2Item { id }
    }
  }
`;

/** List the org's Projects V2 (for the source selector). */
export const ORG_PROJECTS_QUERY = /* GraphQL */ `
  query OrgProjects($login: String!, $cursor: String) {
    organization(login: $login) {
      projectsV2(first: 50, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes { id number title }
      }
    }
  }
`;

/** All repos + their milestone titles in one paginated query (org-wide milestone selector). */
export const ORG_MILESTONES_QUERY = /* GraphQL */ `
  query OrgMilestones($login: String!, $cursor: String) {
    organization(login: $login) {
      repositories(first: 100, after: $cursor, orderBy: { field: PUSHED_AT, direction: DESC }) {
        pageInfo { hasNextPage endCursor }
        nodes {
          milestones(first: 100, states: [OPEN]) {
            nodes { title }
          }
        }
      }
    }
  }
`;

/** Parent + sub-issues for an issue (the sub-issues feature). */
export const ISSUE_RELATIONS_QUERY = /* GraphQL */ `
  query IssueRelations($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      issue(number: $number) {
        parent { number title state url repository { nameWithOwner } }
        subIssues(first: 50) {
          totalCount
          nodes { number title state url repository { nameWithOwner } }
        }
        closedByPullRequestsReferences(first: 10, includeClosedPrs: true) {
          nodes { number title url state repository { nameWithOwner } }
        }
        timelineItems(first: 50, itemTypes: [CROSS_REFERENCED_EVENT]) {
          nodes {
            __typename
            ... on CrossReferencedEvent {
              source {
                __typename
                ... on Issue { number title url state repository { nameWithOwner } }
                ... on PullRequest { number title url state repository { nameWithOwner } }
              }
            }
          }
        }
      }
    }
  }
`;

/** Resolve a repository node id (transfer target). */
export const REPO_ID_QUERY = /* GraphQL */ `
  query RepoId($owner: String!, $name: String!) {
    repository(owner: $owner, name: $name) { id nameWithOwner }
  }
`;

export const TRANSFER_ISSUE_MUTATION = /* GraphQL */ `
  mutation TransferIssue($input: TransferIssueInput!) {
    transferIssue(input: $input) {
      issue { id number url repository { nameWithOwner } }
    }
  }
`;

export const ADD_PROJECT_ITEM_MUTATION = /* GraphQL */ `
  mutation AddItem($input: AddProjectV2ItemByIdInput!) {
    addProjectV2ItemById(input: $input) { item { id } }
  }
`;

export const DELETE_PROJECT_ITEM_MUTATION = /* GraphQL */ `
  mutation DeleteItem($input: DeleteProjectV2ItemInput!) {
    deleteProjectV2Item(input: $input) { deletedItemId }
  }
`;
