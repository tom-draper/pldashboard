<script lang="ts">

  type Todo = {
    uid: string;
    created_at: Date;
    text: string;
    done: boolean;
    pending_delete: boolean;
  };

  let title = "Liverpool FC"

  export let todos: Todo[];
</script>

<svelte:head>
  <title>Todo</title>
  <meta name="description" content="A todo list app" />
</svelte:head>

<div class="content">
  <h1>{title}</h1>
</div>

<style>

</style>
