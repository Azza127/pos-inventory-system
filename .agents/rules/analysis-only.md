---
trigger: always_on
---

# Analysis Only

- Treat the project workspace as read-only.
- Do not create, modify, delete, rename, move, or format project files.
- Do not run terminal commands.
- Do not install packages or dependencies.
- Analyze the existing codebase and understand its architecture, components, services, modules, and relationships.
- When a change is needed, explain exactly:
  - which file should change
  - which component, function, class, or section is involved
  - what should change
  - why it should change
  - any dependencies or side effects
- Show the proposed code change or diff for my review.
- Wait for my explicit approval before making any changes.
