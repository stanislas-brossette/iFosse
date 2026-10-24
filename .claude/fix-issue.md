Fix GitHub issue #$ARGUMENTS.
1. `gh issue view $ARGUMENTS`, read the referenced files and relevant decisions.
2. Propose a plan (files, migration, tests) and wait for my approval.
3. Write failing tests first, then implement.
4. Run the full check list from CLAUDE.md and fix failures.
5. Commit, push the branch, open a PR in the AGENTS.md format with "Closes #$ARGUMENTS".
