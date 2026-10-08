import { startTransition, type FormEvent } from "react";

// `<form action>` resets the form after every submit, so a server error wipes what was typed (and
// unticks controlled checkboxes and radios in the DOM). Submitting through onSubmit skips that reset;
// `pending` from useActionState still works because the dispatch runs in a transition.
export function keepFormValues(dispatch: (formData: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const formData = new FormData(event.currentTarget, submitter);
    startTransition(() => dispatch(formData));
  };
}
