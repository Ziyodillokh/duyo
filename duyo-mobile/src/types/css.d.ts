// Allow side-effect imports of stylesheets and CSS Module imports.
declare module '*.css';
declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}
