# remote-promises

An ES6 library to add a network abstraction between calls to and fulfillment of function promises

# Usage (typical operation)

Instead of being confined to a single application running on a single processor:

```javascript
	function somePromiseFunction(){ return new Promise( ... ) }

	somePromiseFunction( args )
		.then( ... )
		.catch( ... )
		.finally( ... );

```


With remote-promises, we can move the handling of the function to a different process or machine.

In the typical configuration, the function is handled by a system that also acts as a server. The function is called by a system that is acts as the client. For this configuration we use the `.serve()` and `.client()` methods.

For example to move the above call to a function server called `some_server`, it would just require:


```javascript
	function somePromiseFunction(){ return new Promise( ... ) }

	RemotePromise.serve( somePromiseFunction, 3000, { path: "somePath" } );
```

and from some other process/system do:

```javascript
	const somePromiseFunction = RemotePromise.client( "ws://some_server:3000/somePath" );

	somePromiseFunction( args )
		.then( ... )
		.catch( ... )
		.finally( ... );
```


Of course remote-promises works with regular functions as well. In this case it converts them into promise functions, e.g.:


```javascript
	function simple(){ return "success"; }

	RemotePromise.serve( simple, 3000, { path: "somePath" } );
```

```javascript
	const simpleAsPromise = RemotePromise.client( "ws://some_server:3000/somePath" );

	simpleAsPromise( args )
		.then( ... )
		.catch( ... )
		.finally( ... );
```


# Usage (flipped operation)

In most configurations, the callee is the client and the function handler is the server, but it can also be reversed. 

For flipped operation the callee acts as a server, using the `.marshal()` methed, and the function handler acts as a network client using the `.provide()` method.


```javascript
	function somePromiseFunction(){ return new Promise( ... ) }

	RemotePromise.provide( somePromiseFunction, "ws://some_server:3000/somePath" );	
```

and from some other process/system do:

```javascript
	const somePromiseFunction = await RemotePromise.marshal( 3000, { path: "somePath" } );

	somePromiseFunction( args )
		.then( ... )
		.catch( ... )
		.finally( ... );
```


## Multiple providers

In flipped operation, a server that is marshalling ( via `.marshal()` ) can accept multiple providers ( via `.provide()`. In such a case, the work is delegated in turn to provider with the lowest number of outstanding requests.

Note that there are no constraints requiring that the implementation of each function be identical, which could lead to some unanticipated effects.


# Await

As with all promise returning functions, remote-promises can be used with the `await` construct. E.g.:

```javascript
	const somePromiseFunction = await RemotePromise.marshal( 3000, { path: "somePath" } );
	
	try {
		const result = await somePromiseFunction( args );
		...
	}
	catch ( err ){
		...
	}
```

--------------
# API


## serve ( <func>, <port>[, <options>?] )
## frpfsServe ( <func>, <port>[, <options>?] )
## frpfsFunctionServer ( <func>, <url> )

### <func> 

a function that returns a promise ( or, equivalently, an async function ).

### <port>

the port number on which the service should be offered

### <options>

Other server options, see socket.io


## client ( <url> )
## ffpClient ( <url> )
## ffpCallerClient ( <func>, <url> )

### <url>

A web socket url, served via the `serve()` method

### returns

Returns a function that returns a promise that resolves with the result of the function as executed on the system running the `serve()` call.


## provide ( <func>, <url> )
## frpfcProvide ( <func>, <url> )
## frpfcFuncitonClient ( <func>, <url> )

### <func> 

a function that returns a promise ( or, equivalently, an async function ).
### <url>

A web socket url, being marshaled via the `marshal()` method

## marshal ( <port>[, <options>?] )
## ffpMarshal ( <port>[, <options>?] )
## ffpCallerServer ( <port>[, <options>?] )

### <port>

the port number to which the service should be provided via a `provide()` call

### <options>

Other server options, see socket.io

### returns

Returns a function that returns a promise that resolves with the result of the function as executed on the system running the `provide()` call.



